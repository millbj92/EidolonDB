import Fastify, { type FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAnd,
  mockEq,
  mockGt,
  mockSql,
  mockDbUpdate,
  mockDbInsert,
  mockDbExecute,
  mockUpdateSet,
  mockUpdateWhere,
  mockUpdateReturning,
  mockInsertValues,
  mockRecordMemoryAccess,
} = vi.hoisted(() => ({
  mockAnd: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  mockEq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  mockGt: vi.fn((...args: unknown[]) => ({ op: 'gt', args })),
  mockSql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    { raw: vi.fn((value: string) => ({ raw: value })) }
  ),
  mockDbUpdate: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbExecute: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockInsertValues: vi.fn(),
  mockRecordMemoryAccess: vi.fn(),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: mockAnd,
    eq: mockEq,
    gt: mockGt,
    sql: mockSql,
  };
});

function setupDbMocks() {
  mockDbUpdate.mockImplementation(() => ({
    set: mockUpdateSet,
  }));

  mockUpdateSet.mockImplementation(() => ({
    where: mockUpdateWhere,
  }));

  mockDbInsert.mockImplementation(() => ({
    values: mockInsertValues,
  }));
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof Error && error.name === 'ZodError') {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error,
        },
      });
    }

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return app;
}

describe('feedback service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupDbMocks();
  });

  it('POST /feedback/mark-used updates retrieval events and returns count', async () => {
    const memoryA = '11111111-1111-4111-8111-111111111111';
    const memoryB = '22222222-2222-4222-8222-222222222222';

    mockUpdateWhere.mockImplementation(() => ({
      returning: mockUpdateReturning,
    }));
    mockUpdateReturning
      .mockResolvedValueOnce([{ id: 'a' }])
      .mockResolvedValueOnce([{ id: 'b' }, { id: 'c' }]);

    vi.doMock('../../../common/db/index.js', () => ({
      db: {
        update: mockDbUpdate,
        insert: mockDbInsert,
        execute: mockDbExecute,
      },
      retrieval_events: {
        tenantId: 'tenant_id',
        memoryId: 'memory_id',
        wasUsed: 'was_used',
        createdAt: 'created_at',
        id: 'id',
      },
      memories: {
        id: 'id',
        tenantId: 'tenant_id',
        retrievalCount: 'retrieval_count',
      },
    }));

    mockRecordMemoryAccess.mockResolvedValue(null);
    vi.doMock('../../memories/index.js', () => ({
      recordMemoryAccess: mockRecordMemoryAccess,
    }));

    const { markUsed } = await import('../service.js');

    const result = await markUsed('tenant-1', {
      memoryIds: [memoryA, memoryB],
      relevanceFeedback: {
        [memoryA]: 0.9,
      },
    });

    expect(result).toEqual({
      updated: 3,
      memoryIds: [memoryA, memoryB],
    });
    expect(mockUpdateSet).toHaveBeenNthCalledWith(1, { wasUsed: true, relevanceFeedback: 0.9 });
    expect(mockUpdateSet).toHaveBeenNthCalledWith(2, { wasUsed: true });
    expect(mockRecordMemoryAccess).toHaveBeenCalledTimes(2);
  });

  it('GET /feedback/stats/:memoryId returns aggregated stats', async () => {
    const memoryId = '33333333-3333-4333-8333-333333333333';

    mockDbExecute.mockResolvedValue({
      rows: [
        {
          memory_id: memoryId,
          retrieval_count: 5,
          usage_count: 2,
          avg_relevance_feedback: 0.8,
          avg_retrieval_score: 0.74,
          last_retrieved_at: new Date('2026-04-07T12:00:00.000Z'),
        },
      ],
    });

    vi.doMock('../../../common/db/index.js', () => ({
      db: {
        update: mockDbUpdate,
        insert: mockDbInsert,
        execute: mockDbExecute,
      },
      retrieval_events: {
        tenantId: 'tenant_id',
        memoryId: 'memory_id',
        wasUsed: 'was_used',
        createdAt: 'created_at',
        id: 'id',
      },
      memories: {
        id: 'id',
        tenantId: 'tenant_id',
        retrievalCount: 'retrieval_count',
      },
    }));
    vi.doMock('../../memories/index.js', () => ({
      recordMemoryAccess: mockRecordMemoryAccess,
    }));

    const { getRetrievalStats } = await import('../service.js');
    const stats = await getRetrievalStats('tenant-1', memoryId);

    expect(stats).toEqual({
      memoryId,
      retrievalCount: 5,
      usageCount: 2,
      avgRelevanceFeedback: 0.8,
      avgRetrievalScore: 0.74,
      lastRetrievedAt: '2026-04-07T12:00:00.000Z',
    });
  });
});

describe('memories query retrieval logging', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('retrieval event is logged when POST /memories/query is called', async () => {
    const mockQueryMemories = vi.fn().mockResolvedValue([
      {
        memory: { id: '44444444-4444-4444-8444-444444444444' },
        score: 0.91,
        reasons: { semantic: 0.9, recency: 0.8, importance: 0.7 },
      },
    ]);
    const mockRecordMemoryRetrievals = vi.fn().mockResolvedValue(undefined);

    vi.doMock('../../memories/service.js', () => ({
      queryMemories: mockQueryMemories,
      recordMemoryRetrievals: mockRecordMemoryRetrievals,
      getMemoryById: vi.fn(),
      listMemories: vi.fn(),
      updateMemory: vi.fn(),
      deleteMemory: vi.fn(),
      recordMemoryAccess: vi.fn(),
      getMemoryStats: vi.fn(),
    }));

    const { memoriesRoutes } = await import('../../memories/routes.js');
    const app = await buildTestApp();
    await app.register(memoriesRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/memories/query',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        text: 'project plan',
        k: 5,
        sessionId: 'session-abc',
        actorId: 'actor-123',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockRecordMemoryRetrievals).toHaveBeenCalledWith('tenant-1', {
      queryText: 'project plan',
      sessionId: 'session-abc',
      actorId: 'actor-123',
      retrievals: [
        {
          memoryId: '44444444-4444-4444-8444-444444444444',
          retrievalScore: 0.91,
        },
      ],
    });

    await app.close();
  });

  it('retrievalCount incremented on query', async () => {
    setupDbMocks();
    vi.unmock('../../memories/service.js');

    mockInsertValues.mockResolvedValue(undefined);
    mockUpdateWhere.mockResolvedValue(undefined);

    vi.doMock('../../../common/db/index.js', () => ({
      db: {
        update: mockDbUpdate,
        insert: mockDbInsert,
        execute: mockDbExecute,
      },
      memories: {
        id: 'id',
        tenantId: 'tenant_id',
        retrievalCount: 'retrieval_count',
      },
      retrieval_events: {
        id: 'id',
      },
      embeddings: {},
    }));

    const memoriesService = await vi.importActual<typeof import('../../memories/service.js')>(
      '../../memories/service.js'
    );
    const { recordMemoryRetrievals } = memoriesService;

    await recordMemoryRetrievals('tenant-1', {
      queryText: 'project plan',
      retrievals: [
        {
          memoryId: '55555555-5555-4555-8555-555555555555',
          retrievalScore: 0.75,
        },
      ],
    });

    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    const updatePayload = mockUpdateSet.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(updatePayload?.['retrievalCount']).toBeDefined();
    expect(updatePayload?.['lastRetrievedAt']).toBeInstanceOf(Date);
  });
});
