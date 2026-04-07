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
  const limit = Number.parseInt(limitRaw, 10);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;

  if (!q) {
    return Response.json({ results: [] });
  }

  const upstream = new URL('/memories/query', baseUrl);
  upstream.searchParams.set('q', q);
  upstream.searchParams.set('limit', String(safeLimit));

  const response = await fetch(upstream.toString(), {
    method: 'GET',
    headers: {
      'x-tenant-id': tenant.tenantSlug,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });

  const text = await response.text();
  let json: unknown = { results: [] };
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = { results: [] };
  }

  if (!response.ok) {
    return Response.json(
      { message: 'Upstream EidolonDB query failed.', upstreamStatus: response.status, results: [] },
      { status: 502 }
    );
  }

  if (typeof json === 'object' && json !== null && 'results' in json) {
    return Response.json(json);
  }

  if (Array.isArray(json)) {
    return Response.json({ results: json });
  }

  return Response.json({ results: [] });
}
