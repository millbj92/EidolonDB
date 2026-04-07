import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { EidolonDB } from '../src/index';

describe('Ingest convenience methods', () => {
  const url = 'http://localhost:3000';
  const tenant = 'test-tenant';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('db.ingest(content) calls POST /ingest', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              success: true,
              traceId: '00000000-0000-0000-0000-000000000001',
              summary: { candidates: 1, accepted: 1, rejected: 0 },
              acceptedMemories: [],
              rejectedMemories: [],
              warnings: [],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    const response = await db.ingest('Today we chose Fastify.', { source: 'chat' });

    expect(response.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${url}/ingest`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({ content: 'Today we chose Fastify.', source: 'chat' });
  });

  test('response shape matches IngestResponse type', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            success: true,
            traceId: '00000000-0000-0000-0000-000000000002',
            summary: { candidates: 2, accepted: 1, rejected: 1 },
            acceptedMemories: [
              {
                content: 'a',
                memoryType: 'semantic',
                importance: 0.7,
                confidence: 0.8,
                tags: [],
                sourceSpan: 'span',
                rationale: 'reason',
                dedupStatus: 'new',
              },
            ],
            rejectedMemories: [
              {
                content: 'b',
                memoryType: 'episodic',
                importance: 0.3,
                confidence: 0.4,
                tags: [],
                sourceSpan: 'span',
                rationale: 'reason',
                dedupStatus: 'duplicate',
                reason: 'already exists',
              },
            ],
            warnings: [],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    const response = await db.ingest('Content', { source: 'note' });

    expect(response.summary.candidates).toBe(2);
    expect(response.acceptedMemories[0]?.dedupStatus).toBe('new');
    expect(response.rejectedMemories[0]?.reason).toBe('already exists');
  });

  test('db.remember(content) calls POST /memories with tier=semantic', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'm1',
            tenantId: tenant,
            ownerEntityId: null,
            tier: 'semantic',
            content: 'Remember this',
            sourceArtifactId: null,
            sourceEventId: null,
            embeddingId: null,
            importanceScore: 0.5,
            recencyScore: 1,
            accessCount: 0,
            lastAccessedAt: null,
            metadata: {},
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    await db.remember('Remember this');

    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${url}/memories`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ tier: 'semantic', content: 'Remember this' });
  });
});
