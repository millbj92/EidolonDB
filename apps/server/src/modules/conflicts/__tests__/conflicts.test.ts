import Fastify, { type FastifyInstance } from 'fastify';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const {
  mockAnd,
  mockEq,
  mockDesc,
  mockDbSelect,
  mockDbUpdate,
  mockUpdateSet,
  mockUpdateWhere,
  mockQueryMemories,
  mockCreateMemory,
} = vi.hoisted(() => ({
  mockAnd: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  mockEq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  mockDesc: vi.fn((arg: unknown) => ({ op: 'desc', arg })),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockQueryMemories: vi.fn(),
  mockCreateMemory: vi.fn(),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: mockAnd,
    eq: mockEq,
    desc: mockDesc,
  };
});

vi.mock('../../../common/config/index.js', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
  },
}));

vi.mock('../../../common/db/index.js', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
  memories: {
    id: 'id',
    tenantId: 'tenant_id',
    content: 'content',
    importanceScore: 'importance_score',
    createdAt: 'created_at',
    conflictStatus: 'conflict_status',
    conflictGroupId: 'conflict_group_id',
    conflictResolution: 'conflict_resolution',
    resolvedAt: 'resolved_at',
    updatedAt: 'updated_at',
    tags: 'tags',
    ownerEntityId: 'owner_entity_id',
    tier: 'tier',
  },
}));

vi.mock('../../memories/index.js', () => ({
  queryMemories: mockQueryMemories,
  createMemory: mockCreateMemory,
}));

function makeSelectBuilder() {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };
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

describe('conflict service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockImplementation(() => ({
      set: mockUpdateSet,
    }));
    mockUpdateSet.mockImplementation(() => ({
      where: mockUpdateWhere,
    }));
    mockUpdateWhere.mockResolvedValue([]);
    mockQueryMemories.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isContradiction returns true for opposing port claims', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isContradiction: true,
                confidence: 0.96,
                explanation: 'Both statements assign different port values to the same API.',
              }),
            },
          },
        ],
      }),
    }));

    const { isContradiction } = await import('../conflictService.js');
    const result = await isContradiction('The API port is 8080.', 'The API port is 3000.');

    expect(result.isConflict).toBe(true);
    expect(result.confidence).toBe(0.96);
  });

  it('isContradiction returns false for unrelated facts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isContradiction: false,
                confidence: 0.92,
                explanation: 'The statements refer to unrelated subjects.',
              }),
            },
          },
        ],
      }),
    }));

    const { isContradiction } = await import('../conflictService.js');
    const result = await isContradiction('Uses Python.', 'Port is 3000.');

    expect(result.isConflict).toBe(false);
  });

  it('resolveConflict with newer-wins marks older memory as resolved', async () => {
    const older = {
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: 'tenant-1',
      content: 'API runs on port 8080',
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      importanceScore: 0.7,
      conflictGroupId: null,
      tags: [],
      ownerEntityId: null,
      tier: 'episodic' as const,
    };
    const newer = {
      ...older,
      id: '22222222-2222-4222-8222-222222222222',
      content: 'API runs on port 3000',
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
    };

    const selectA = makeSelectBuilder();
    selectA.limit.mockResolvedValueOnce([older]);
    const selectB = makeSelectBuilder();
    selectB.limit.mockResolvedValueOnce([newer]);
    mockDbSelect.mockReturnValueOnce(selectA).mockReturnValueOnce(selectB);

    const { resolveConflict } = await import('../conflictService.js');
    const result = await resolveConflict('tenant-1', older.id, newer.id, 'newer-wins');

    expect(result.status).toBe('resolved');
    expect(result.resolvedMemoryIds).toEqual([older.id]);
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      conflictStatus: 'resolved',
      conflictResolution: 'newer-wins',
    }));
  });

  it('resolveConflict with merge creates a new merged memory', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'The API used port 8080 before migrating to port 3000.',
            },
          },
        ],
      }),
    }));

    const memoryA = {
      id: '33333333-3333-4333-8333-333333333333',
      tenantId: 'tenant-1',
      content: 'Port is 8080',
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      importanceScore: 0.6,
      conflictGroupId: null,
      tags: ['api'],
      ownerEntityId: null,
      tier: 'episodic' as const,
    };
    const memoryB = {
      ...memoryA,
      id: '44444444-4444-4444-8444-444444444444',
      content: 'Port is 3000',
      createdAt: new Date('2026-04-11T00:00:00.000Z'),
      importanceScore: 0.9,
    };

    const selectA = makeSelectBuilder();
    selectA.limit.mockResolvedValueOnce([memoryA]);
    const selectB = makeSelectBuilder();
    selectB.limit.mockResolvedValueOnce([memoryB]);
    mockDbSelect.mockReturnValueOnce(selectA).mockReturnValueOnce(selectB);
    mockCreateMemory.mockResolvedValueOnce({
      memory: { id: '55555555-5555-4555-8555-555555555555' },
      embeddingId: null,
    });

    const { resolveConflict } = await import('../conflictService.js');
    const result = await resolveConflict('tenant-1', memoryA.id, memoryB.id, 'merge');

    expect(mockCreateMemory).toHaveBeenCalledTimes(1);
    expect(result.mergedMemoryId).toBe('55555555-5555-4555-8555-555555555555');
    expect(result.status).toBe('resolved');
  });
});

describe('conflicts routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('POST /conflicts/detect returns conflict list', async () => {
    const detectConflictMock = vi.fn()
      .mockResolvedValueOnce({
        isConflict: true,
        conflictingMemoryId: '77777777-7777-4777-8777-777777777777',
        confidence: 0.95,
        explanation: 'Both claim different ports for the API',
      })
      .mockResolvedValueOnce({
        isConflict: false,
      });
    const resolveConflictMock = vi.fn().mockResolvedValue({
      status: 'resolved',
      strategy: 'newer-wins',
      conflictGroupId: '66666666-6666-4666-8666-666666666666',
      resolvedMemoryIds: ['66666666-6666-4666-8666-666666666666'],
    });

    const selectBuilder = makeSelectBuilder();
    selectBuilder.limit.mockResolvedValueOnce([
      {
        id: '66666666-6666-4666-8666-666666666666',
        tenantId: 'tenant-1',
        content: 'API port is 8080',
        conflictStatus: 'none',
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        tenantId: 'tenant-1',
        content: 'API port is 3000',
        conflictStatus: 'none',
        createdAt: new Date('2026-04-11T00:00:00.000Z'),
      },
    ]);
    mockDbSelect.mockReturnValue(selectBuilder);

    vi.doMock('../conflictService.js', () => ({
      detectConflict: detectConflictMock,
      resolveConflict: resolveConflictMock,
    }));
    vi.doMock('../../../common/config/index.js', () => ({
      env: {
        OPENAI_API_KEY: 'test-key',
      },
    }));
    vi.doMock('../../../common/embeddings/index.js', () => ({
      OpenAIEmbeddingsProvider: class OpenAIEmbeddingsProvider {},
    }));
    vi.doMock('../../../common/db/index.js', () => ({
      db: {
        select: mockDbSelect,
      },
      memories: {
        id: 'id',
        tenantId: 'tenant_id',
        conflictStatus: 'conflict_status',
        createdAt: 'created_at',
      },
    }));

    const { conflictsRoutes } = await import('../routes.js');
    const app = await buildTestApp();
    await app.register(conflictsRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/conflicts/detect',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        autoResolve: true,
        strategy: 'newer-wins',
        limit: 50,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.data.conflictsFound).toBe(1);
    expect(payload.data.autoResolved).toBe(1);
    expect(payload.data.conflicts[0].confidence).toBe(0.95);
  });
});
