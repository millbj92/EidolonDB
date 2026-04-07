import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInsertValues, mockDbInsert, mockCreateMemory, mockCheckDedup } = vi.hoisted(() => ({
  mockInsertValues: vi.fn(),
  mockDbInsert: vi.fn(),
  mockCreateMemory: vi.fn(),
  mockCheckDedup: vi.fn(),
}));

mockDbInsert.mockImplementation(() => ({ values: mockInsertValues }));

vi.mock('../../../common/db/index.js', () => ({
  db: {
    insert: mockDbInsert,
  },
  ingestTraces: {},
}));

vi.mock('../../memories/index.js', () => ({
  createMemory: mockCreateMemory,
}));

vi.mock('../dedupService.js', () => ({
  checkDedup: mockCheckDedup,
}));

import { runIngestPipeline } from '../ingestService.js';

function makeLlmResponse(candidateMemories: Array<Record<string, unknown>>) {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({ candidateMemories }),
          },
        },
      ],
    }),
  };
}

const baseRequest = {
  content: 'Alice committed to shipping the API by Friday and prefers email updates.',
  source: 'chat' as const,
  autoStore: true,
  debug: false,
};

describe('runIngestPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeLlmResponse([
      {
        content: 'Alice committed to shipping the API by Friday.',
        memoryType: 'episodic',
        importance: 0.8,
        confidence: 0.9,
        tags: ['alice', 'commitment', 'api'],
        sourceSpan: 'Alice committed to shipping the API by Friday',
        rationale: 'Tracks a concrete commitment and deadline.',
      },
    ])));
    mockInsertValues.mockResolvedValue(undefined);
    mockCheckDedup.mockResolvedValue({ status: 'new' });
    mockCreateMemory.mockResolvedValue({
      memory: { id: '11111111-1111-4111-8111-111111111111' },
      embeddingId: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles a valid ingest request', async () => {
    const result = await runIngestPipeline('tenant-1', baseRequest);

    expect(result.success).toBe(true);
    expect(result.summary).toEqual({
      candidates: 1,
      accepted: 1,
      rejected: 0,
    });
    expect(result.acceptedMemories[0]?.memoryId).toBe('11111111-1111-4111-8111-111111111111');
    expect(mockCreateMemory).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });

  it('rejects low-confidence candidates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeLlmResponse([
      {
        content: 'Potential idea with no evidence.',
        memoryType: 'short_term',
        importance: 0.2,
        confidence: 0.2,
        tags: ['idea'],
        sourceSpan: 'Potential idea',
        rationale: 'Uncertain claim.',
      },
    ])));

    const result = await runIngestPipeline('tenant-1', baseRequest);

    expect(result.summary).toEqual({
      candidates: 1,
      accepted: 0,
      rejected: 1,
    });
    expect(result.rejectedMemories[0]?.reason).toContain('confidence below 0.3');
    expect(mockCheckDedup).not.toHaveBeenCalled();
  });

  it('rejects duplicate candidates', async () => {
    mockCheckDedup.mockResolvedValue({
      status: 'duplicate',
      matchedMemoryId: 'existing-memory-id',
      similarity: 0.98,
    });

    const result = await runIngestPipeline('tenant-1', baseRequest);

    expect(result.summary.accepted).toBe(0);
    expect(result.summary.rejected).toBe(1);
    expect(result.rejectedMemories[0]?.dedupStatus).toBe('duplicate');
  });

  it('skips persistence when autoStore is false', async () => {
    const result = await runIngestPipeline('tenant-1', {
      ...baseRequest,
      autoStore: false,
    });

    expect(result.summary.accepted).toBe(1);
    expect(result.acceptedMemories[0]?.memoryId).toBeUndefined();
    expect(mockCreateMemory).not.toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });

  it('handles malformed LLM JSON gracefully and still writes trace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not-json' } }],
      }),
    }));

    const result = await runIngestPipeline('tenant-1', baseRequest);

    expect(result.summary).toEqual({ candidates: 0, accepted: 0, rejected: 0 });
    expect(result.warnings.some((warning) => warning.includes('Extraction skipped'))).toBe(true);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });

  it('always writes a trace record even when extraction fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream error',
    }));

    const result = await runIngestPipeline('tenant-1', baseRequest);

    expect(result.summary.candidates).toBe(0);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });
});

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

describe('ingestRoutes', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns 400 when x-tenant-id header is missing', async () => {
    vi.doMock('../service.js', () => ({
      runIngestPipeline: vi.fn(),
    }));

    const { ingestRoutes } = await import('../routes.js');
    const app = await buildTestApp();
    await app.register(ingestRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: {
        content: 'This is valid content for ingest.',
        source: 'chat',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('MISSING_TENANT_ID');
    await app.close();
  });

  it('rejects empty content payload', async () => {
    vi.doMock('../service.js', () => ({
      runIngestPipeline: vi.fn(),
    }));

    const { ingestRoutes } = await import('../routes.js');
    const app = await buildTestApp();
    await app.register(ingestRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/ingest',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        content: '',
        source: 'chat',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('returns debug payload only when requested', async () => {
    const runIngestPipelineMock = vi.fn().mockResolvedValue({
      success: true,
      traceId: '22222222-2222-4222-8222-222222222222',
      summary: { candidates: 1, accepted: 1, rejected: 0 },
      acceptedMemories: [],
      rejectedMemories: [],
      warnings: [],
      debug: {
        normalizedInput: 'normalized text',
        extractorVersion: 'v1',
        promptVersion: 'auto-extract-v1',
        durationMs: 12,
      },
      errors: [],
    });

    vi.doMock('../service.js', () => ({
      runIngestPipeline: runIngestPipelineMock,
    }));

    const { ingestRoutes } = await import('../routes.js');
    const app = await buildTestApp();
    await app.register(ingestRoutes);

    const withoutDebug = await app.inject({
      method: 'POST',
      url: '/ingest',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        content: 'This is valid content for ingest.',
        source: 'chat',
      },
    });

    const withDebug = await app.inject({
      method: 'POST',
      url: '/ingest',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        content: 'This is valid content for ingest.',
        source: 'chat',
        debug: true,
      },
    });

    expect(withoutDebug.statusCode).toBe(200);
    expect(withoutDebug.json().data.debug).toBeUndefined();

    expect(withDebug.statusCode).toBe(200);
    expect(withDebug.json().data.debug).toBeDefined();
    await app.close();
  });
});
