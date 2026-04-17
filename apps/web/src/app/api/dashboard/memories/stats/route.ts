import { getTenantContextFromAuth } from '@/lib/db-utils';

export async function GET(): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Tenant not found.' }, { status: 404 });
  }

  const gatewayUrl = process.env['EIDOLONDB_INTERNAL_URL'] ?? 'https://api.eidolondb.com';
  const serviceKey = process.env['EIDOLONDB_SERVICE_KEY'];
  if (!serviceKey) {
    return Response.json({ message: 'EIDOLONDB_SERVICE_KEY is not configured.' }, { status: 503 });
  }

  const url = new URL('/memories/stats', gatewayUrl);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'x-tenant-slug': tenant.tenantSlug,
    },
    cache: 'no-store',
  });

  const text = await response.text();
  let json: unknown = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }

  if (!response.ok) {
    return Response.json(
      { message: 'Failed to load memory stats.', upstreamStatus: response.status },
      { status: 502 }
    );
  }

  const unwrapped = (typeof json === 'object' && json !== null && 'data' in json)
    ? (json as Record<string, unknown>)['data']
    : json;

  return Response.json(unwrapped);
}
