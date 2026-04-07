export interface EidolonDBConfig {
  url: string;
  tenant: string;
  fetch?: typeof fetch;
  timeout?: number;
}

interface RequestOptions {
  query?: object;
  signal?: AbortSignal;
}

interface ErrorBodyShape {
  error?: {
    message?: string;
  };
  message?: string;
}

export class EidolonDBError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown
  ) {
    super(message);
    this.name = 'EidolonDBError';
  }
}

function appendQueryParams(url: URL, query?: object): void {
  if (!query) {
    return;
  }

  for (const [key, raw] of Object.entries(query as Record<string, unknown>)) {
    if (raw === undefined || raw === null) {
      continue;
    }

    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item !== undefined && item !== null) {
          url.searchParams.append(key, String(item));
        }
      }
      continue;
    }

    if (raw instanceof Date) {
      url.searchParams.set(key, raw.toISOString());
      continue;
    }

    if (typeof raw === 'object') {
      url.searchParams.set(key, JSON.stringify(raw));
      continue;
    }

    url.searchParams.set(key, String(raw));
  }
}

function mergeSignals(timeoutSignal: AbortSignal, externalSignal?: AbortSignal): AbortSignal {
  if (!externalSignal) {
    return timeoutSignal;
  }

  if (externalSignal.aborted) {
    return externalSignal;
  }

  const merged = new AbortController();
  const onAbort = () => merged.abort();

  timeoutSignal.addEventListener('abort', onAbort, { once: true });
  externalSignal.addEventListener('abort', onAbort, { once: true });

  return merged.signal;
}

export class EidolonDBClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: EidolonDBConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeout ?? 30_000;

    if (!this.fetchImpl) {
      throw new Error('No fetch implementation found. Pass config.fetch in Node.js < 18.');
    }
  }

  /**
   * Execute an HTTP request against the EidolonDB API.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    appendQueryParams(url, options?.query);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': this.config.tenant,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: mergeSignals(controller.signal, options?.signal),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network request failed';
      throw new EidolonDBError(0, message, null);
    } finally {
      clearTimeout(timeout);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();

    let parsedBody: unknown = undefined;
    if (text.length > 0) {
      if (contentType.includes('application/json')) {
        try {
          parsedBody = JSON.parse(text) as unknown;
        } catch {
          parsedBody = text;
        }
      } else {
        parsedBody = text;
      }
    }

    if (!response.ok) {
      const bodyShape = parsedBody as ErrorBodyShape | undefined;
      const message =
        bodyShape?.error?.message ??
        bodyShape?.message ??
        response.statusText ??
        `Request failed with status ${response.status}`;

      throw new EidolonDBError(response.status, message, parsedBody);
    }

    if (parsedBody && typeof parsedBody === 'object' && 'data' in (parsedBody as Record<string, unknown>)) {
      return (parsedBody as { data: T }).data;
    }

    return parsedBody as T;
  }
}
