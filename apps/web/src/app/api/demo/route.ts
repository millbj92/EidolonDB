import { NextResponse } from 'next/server';

type DemoAction = 'init' | 'ingest' | 'recall' | 'validate' | 'list';

type DemoRequestBody = {
  action?: DemoAction;
  tenantId?: string;
  text?: string;
  query?: string;
  claim?: string;
};

type MemoryTier = 'short_term' | 'episodic' | 'semantic';

type DemoMemory = {
  id: string;
  tier: MemoryTier;
  content: string;
  importanceScore: number | null;
  createdAt: string;
};

type QueryResult = {
  memory: DemoMemory;
  score: number;
};

const DEFAULT_TENANT_PREFIX = 'demo_';
const DEFAULT_OPS_LIMIT = 20;
const ONE_HOUR_MS = 60 * 60 * 1000;

const SEEDED_MEMORIES = [
  'We decided to use Fastify for the API server, running on port 4000. Sarah leads backend development.',
  "The project is called Helios. It's a TypeScript monorepo using pnpm workspaces.",
  'Sarah strongly prefers async/await over promise chains. No callback-style code in the codebase.',
  "We're deploying to Railway for compute. Postgres on Neon, Redis for job queuing.",
  'Budget is $500/mo for infrastructure. The project is fully bootstrapped with no outside investors.',
];

const opsCounter = new Map<string, number>();

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getTenantPrefix(): string {
  return process.env['DEMO_TENANT_PREFIX'] ?? DEFAULT_TENANT_PREFIX;
}

function getOpsLimit(): number {
  return envNumber('DEMO_OPS_LIMIT', DEFAULT_OPS_LIMIT);
}

function getGatewayConfig(): { baseUrl: string; serviceKey: string } | null {
  const baseUrl = process.env['EIDOLONDB_INTERNAL_URL'];
  const serviceKey = process.env['EIDOLONDB_SERVICE_KEY'];
  if (!baseUrl || !serviceKey) return null;

  return { baseUrl, serviceKey };
}

function parseBody(value: unknown): DemoRequestBody {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  return value as DemoRequestBody;
}

function unwrapData(payload: unknown): unknown {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as Record<string, unknown>)['data'];
  }
  return payload;
}

function parseMemories(payload: unknown): DemoMemory[] {
  const unwrapped = unwrapData(payload);
  if (typeof unwrapped !== 'object' || unwrapped === null || !('memories' in unwrapped)) {
    return [];
  }

  const raw = (unwrapped as Record<string, unknown>)['memories'];
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];

    const record = item as Record<string, unknown>;
    const id = record['id'];
    const tier = record['tier'];
    const content = record['content'];
    const createdAt = record['createdAt'];
    const importanceScore = record['importanceScore'];

    if (
      typeof id !== 'string' ||
      typeof tier !== 'string' ||
      typeof content !== 'string' ||
      typeof createdAt !== 'string'
    ) {
      return [];
    }

    if (tier !== 'short_term' && tier !== 'episodic' && tier !== 'semantic') {
      return [];
    }

    return [
      {
        id,
        tier,
        content,
        createdAt,
        importanceScore: typeof importanceScore === 'number' ? importanceScore : null,
      },
    ];
  });
}

function parseQueryResults(payload: unknown): QueryResult[] {
  const unwrapped = unwrapData(payload);
  if (typeof unwrapped !== 'object' || unwrapped === null || !('results' in unwrapped)) {
    return [];
  }

  const raw = (unwrapped as Record<string, unknown>)['results'];
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];

    const record = item as Record<string, unknown>;
    const maybeMemory =
      typeof record['memory'] === 'object' && record['memory'] !== null
        ? (record['memory'] as Record<string, unknown>)
        : record;

    const parsedMemory = parseMemories({ data: { memories: [maybeMemory] } })[0];
    if (!parsedMemory) return [];

    const scoreRaw = record['score'];
    return [{ memory: parsedMemory, score: typeof scoreRaw === 'number' ? scoreRaw : 0 }];
  });
}

function parseAcceptedCount(payload: unknown): number {
  const unwrapped = unwrapData(payload);
  if (typeof unwrapped !== 'object' || unwrapped === null || !('summary' in unwrapped)) {
    return 0;
  }

  const summary = (unwrapped as Record<string, unknown>)['summary'];
  if (typeof summary !== 'object' || summary === null) return 0;

  const accepted = (summary as Record<string, unknown>)['accepted'];
  return typeof accepted === 'number' ? accepted : 0;
}

function isTenantValid(tenantId: string): boolean {
  return tenantId.startsWith(getTenantPrefix()) && tenantId.length > getTenantPrefix().length;
}

function opsUsedForTenant(tenantId: string): number {
  return opsCounter.get(tenantId) ?? 0;
}

function consumeOp(tenantId: string): { ok: true; used: number } | { ok: false; used: number } {
  const used = opsUsedForTenant(tenantId);
  const limit = getOpsLimit();
  if (used >= limit) {
    return { ok: false, used };
  }

  const next = used + 1;
  opsCounter.set(tenantId, next);
  return { ok: true, used: next };
}

async function eidolonRequest<TPayload>(
  tenantId: string,
  path: string,
  init: RequestInit,
  parse: (payload: unknown) => TPayload
): Promise<TPayload> {
  const config = getGatewayConfig();
  if (!config) {
    throw new Error('EIDOLONDB_INTERNAL_URL and EIDOLONDB_SERVICE_KEY must be configured.');
  }

  const target = new URL(path, config.baseUrl);
  const response = await fetch(target.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
    },
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: unknown = {};

  try {
    payload = text ? (JSON.parse(text) as unknown) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? (payload as Record<string, unknown>)['error']
        : undefined;

    throw new Error(
      typeof message === 'string'
        ? message
        : `EidolonDB request failed (${response.status}) for ${path}`
    );
  }

  return parse(payload);
}

async function listMemories(tenantId: string): Promise<DemoMemory[]> {
  return eidolonRequest(
    tenantId,
    '/memories?limit=20&sortBy=createdAt&sortOrder=desc',
    { method: 'GET' },
    parseMemories
  );
}

async function cleanupExpiredMemories(tenantId: string): Promise<void> {
  const memories = await listMemories(tenantId);
  const now = Date.now();

  const expiredIds = memories
    .filter((memory) => now - new Date(memory.createdAt).getTime() > ONE_HOUR_MS)
    .map((memory) => memory.id);

  if (expiredIds.length === 0) return;

  await Promise.all(
    expiredIds.map(async (id) => {
      await eidolonRequest(tenantId, `/memories/${id}`, { method: 'DELETE' }, () => ({ ok: true }));
    })
  );
}

async function ingestMemory(tenantId: string, text: string): Promise<number> {
  const payload = {
    text,
    content: text,
    source: 'demo',
    metadata: {
      demo: true,
      expiresAt: new Date(Date.now() + ONE_HOUR_MS).toISOString(),
    },
  };

  try {
    return await eidolonRequest(
      tenantId,
      '/ingest',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      parseAcceptedCount
    );
  } catch {
    return eidolonRequest(
      tenantId,
      '/ingest',
      {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          source: 'note',
        }),
      },
      parseAcceptedCount
    );
  }
}

function limitResponse(tenantId: string): Response {
  const limit = getOpsLimit();

  return NextResponse.json(
    {
      message: `Demo limit reached (${limit} ops). Sign up for unlimited access.`,
      opsUsed: opsUsedForTenant(tenantId),
      opsLimit: limit,
      limitReached: true,
    },
    { status: 429 }
  );
}

export async function POST(request: Request): Promise<Response> {
  const body = parseBody(await request.json());
  const action = body.action;
  const tenantId = body.tenantId?.trim();

  if (!action || (action !== 'init' && action !== 'ingest' && action !== 'recall' && action !== 'validate' && action !== 'list')) {
    return NextResponse.json({ message: 'Invalid action.' }, { status: 400 });
  }

  if (!tenantId || !isTenantValid(tenantId)) {
    return NextResponse.json({ message: `Invalid demo tenant. Must start with "${getTenantPrefix()}".` }, { status: 400 });
  }

  const opsLimit = getOpsLimit();

  try {
    await cleanupExpiredMemories(tenantId);

    if (action === 'init') {
      let memories = await listMemories(tenantId);
      let seeded = false;

      if (memories.length === 0) {
        for (const seededText of SEEDED_MEMORIES) {
          await ingestMemory(tenantId, seededText);
        }

        seeded = true;
        memories = await listMemories(tenantId);
      }

      return NextResponse.json({ seeded, memories, opsUsed: opsUsedForTenant(tenantId), opsLimit });
    }

    if (action === 'list') {
      const memories = await listMemories(tenantId);
      return NextResponse.json({ memories, opsUsed: opsUsedForTenant(tenantId), opsLimit });
    }

    if (action === 'ingest') {
      const text = body.text?.trim();
      if (!text) {
        return NextResponse.json({ message: 'Text is required for ingest.' }, { status: 400 });
      }

      const consumed = consumeOp(tenantId);
      if (!consumed.ok) {
        return limitResponse(tenantId);
      }

      const extracted = await ingestMemory(tenantId, text);

      return NextResponse.json({ ok: true, extracted, opsUsed: consumed.used, opsLimit });
    }

    if (action === 'recall') {
      const query = body.query?.trim();
      if (!query) {
        return NextResponse.json({ message: 'Query is required for recall.' }, { status: 400 });
      }

      const consumed = consumeOp(tenantId);
      if (!consumed.ok) {
        return limitResponse(tenantId);
      }

      const results = await eidolonRequest(
        tenantId,
        '/memories/query',
        {
          method: 'POST',
          body: JSON.stringify({ text: query, k: 5 }),
        },
        parseQueryResults
      );

      return NextResponse.json({ results, opsUsed: consumed.used, opsLimit });
    }

    if (action === 'validate') {
      const claim = body.claim?.trim();
      if (!claim) {
        return NextResponse.json({ message: 'Claim is required for validate.' }, { status: 400 });
      }

      const consumed = consumeOp(tenantId);
      if (!consumed.ok) {
        return limitResponse(tenantId);
      }

      const result = await eidolonRequest(
        tenantId,
        '/validate',
        {
          method: 'POST',
          body: JSON.stringify({ claim, k: 5, threshold: 0.65 }),
        },
        unwrapData
      );

      return NextResponse.json({ ...((result as Record<string, unknown>) ?? {}), opsUsed: consumed.used, opsLimit });
    }

    return NextResponse.json({ message: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Demo proxy request failed.',
      },
      { status: 502 }
    );
  }
}
