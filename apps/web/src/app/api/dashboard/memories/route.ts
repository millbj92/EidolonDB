import { getTenantContextFromAuth } from '@/lib/db-utils';

export async function GET(request: Request): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.json({ message: 'Tenant not found.' }, { status: 404 });
  }

  const gatewayUrl = process.env['EIDOLONDB_INTERNAL_URL'] ?? 'https://api.eidolondb.com';
  const serviceKey = process.env['EIDOLONDB_SERVICE_KEY'];
  if (!serviceKey) {
    return Response.json({ message: 'EIDOLONDB_SERVICE_KEY is not configured.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limitRaw = searchParams.get('limit') ?? '20';
  const k = Math.min(Math.max(Number.parseInt(limitRaw, 10) || 20, 1), 100);

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    Authorization: `Bearer ${serviceKey}`,
    'x-tenant-slug': tenant.tenantSlug,
  };

  if (!q) {
    // No query — return recent memories via list endpoint
    const listUrl = new URL('/memories', gatewayUrl);
    listUrl.searchParams.set('limit', String(k));
    listUrl.searchParams.set('sortBy', 'createdAt');
    listUrl.searchParams.set('sortOrder', 'desc');

    const listResp = await fetch(listUrl.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const listText = await listResp.text();
    let listJson: unknown = {};
    try {
      listJson = JSON.parse(listText);
    } catch {
      /* ignore */
    }

    if (!listResp.ok) {
      return Response.json({ results: [] });
    }

    const listData = (typeof listJson === 'object' && listJson !== null && 'data' in listJson)
      ? (listJson as Record<string, unknown>)['data']
      : listJson;

    const memories = (typeof listData === 'object' && listData !== null && 'memories' in listData)
      ? (listData as Record<string, unknown>)['memories']
      : [];

    const results = Array.isArray(memories)
      ? memories.map((m) => ({ memory: m, score: 1 }))
      : [];

    return Response.json({ results });
  }

  // Semantic search
  const searchUrl = new URL('/memories/query', gatewayUrl);
  const response = await fetch(searchUrl.toString(), {
    method: 'POST',
    headers,
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
      { message: 'Memory search failed.', upstreamStatus: response.status, results: [] },
      { status: 502 }
    );
  }

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
