import { getTenantContextFromAuth } from '@/lib/db-utils';

export async function GET(request: Request): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Tenant not found.' }, { status: 404 });
  }

  const baseUrl = process.env['EIDOLONDB_INTERNAL_URL'];
  if (!baseUrl) {
    return Response.json({ message: 'EIDOLONDB_INTERNAL_URL is not configured.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limitRaw = searchParams.get('limit') ?? '20';
  const k = Math.min(Math.max(Number.parseInt(limitRaw, 10) || 20, 1), 100);

  if (!q) {
    return Response.json({ results: [] });
  }

  const upstream = new URL('/memories/query', baseUrl);

  const response = await fetch(upstream.toString(), {
    method: 'POST',
    headers: {
      'x-tenant-id': tenant.tenantSlug,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text: q, k }),
    cache: 'no-store',
  });

  const text = await response.text();
  let json: unknown = { results: [] };
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    /* ignore */
  }

  if (!response.ok) {
    return Response.json(
      { message: 'Upstream EidolonDB query failed.', upstreamStatus: response.status, results: [] },
      { status: 502 }
    );
  }

  // Unwrap { data: { results: [...] } } envelope
  const unwrapped = (typeof json === 'object' && json !== null && 'data' in json)
    ? (json as Record<string, unknown>)['data']
    : json;

  if (typeof unwrapped === 'object' && unwrapped !== null && 'results' in unwrapped) {
    return Response.json(unwrapped);
  }
  if (Array.isArray(unwrapped)) {
    return Response.json({ results: unwrapped });
  }
  return Response.json({ results: [] });
}
