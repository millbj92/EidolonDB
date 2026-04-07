import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { EidolonDB, EidolonDBError } from '../src/index';

describe('MemoriesResource', () => {
  const url = 'http://localhost:3000';
  const tenant = 'test-tenant';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('create sends POST /memories with correct body', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { id: 'm1', tenantId: tenant, content: 'x', tier: 'semantic', ownerEntityId: null, sourceArtifactId: null, sourceEventId: null, embeddingId: null, importanceScore: 0.9, recencyScore: 1, accessCount: 0, lastAccessedAt: null, metadata: {}, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    await db.memories.create({ tier: 'semantic', content: 'hello', importanceScore: 0.9, tags: ['a'] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${url}/memories`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      tier: 'semantic',
      content: 'hello',
      importanceScore: 0.9,
      tags: ['a'],
    });
    expect((init?.headers as Record<string, string>)['x-tenant-id']).toBe(tenant);
  });

  test('search sends POST /memories/query', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(JSON.stringify({ data: { results: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    await db.memories.search('user prefs', { k: 10 });

    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${url}/memories/query`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ text: 'user prefs', k: 10 });
  });

  test('list sends GET /memories with query params', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(JSON.stringify({ data: { memories: [], total: 0, offset: 0, limit: 20 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    await db.memories.list({ limit: 20, offset: 0, tier: 'semantic' });

    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${url}/memories?limit=20&offset=0&tier=semantic`);
    expect(init?.method).toBe('GET');
  });

  test('delete sends DELETE /memories/:id', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(JSON.stringify({ data: { deleted: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    await db.memories.delete('abc');

    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${url}/memories/abc`);
    expect(init?.method).toBe('DELETE');
  });

  test('throws EidolonDBError on non-2xx', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'boom' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });

    let thrown: unknown;
    try {
      await db.memories.get('missing');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EidolonDBError);
    expect(thrown).toMatchObject({ status: 400, message: 'boom' });
  });
});
