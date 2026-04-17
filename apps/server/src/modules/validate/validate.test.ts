import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryMemories } = vi.hoisted(() => ({
  mockQueryMemories: vi.fn(),
}));

vi.mock('../../common/config/index.js', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
  },
}));

vi.mock('../memories/index.js', () => ({
  queryMemories: mockQueryMemories,
}));

function makeMemoryResult(
  id: string,
  content: string,
  semantic: number,
  tier: 'short_term' | 'episodic' | 'semantic' = 'semantic'
) {
  return {
    memory: {
      id,
      tenantId: 'tenant-1',
      ownerEntityId: null,
      tier,
      content,
      sourceArtifactId: null,
      sourceEventId: null,
      embeddingId: null,
      importanceScore: 0.5,
      recencyScore: 0.5,
      accessCount: 0,
      lastAccessedAt: null,
      metadata: {},
      tags: [],
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
    },
    score: semantic,
    reasons: {
      semantic,
      recency: 0,
      importance: 0,
    },
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

describe('validateRoutes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns supported verdict when supporting memory is found', async () => {
    mockQueryMemories.mockResolvedValue([
      makeMemoryResult('11111111-1111-4111-8111-111111111111', 'User prefers dark mode', 0.92),
      makeMemoryResult('22222222-2222-4222-8222-222222222222', 'User uses Vim keybindings', 0.74),
    ]);

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { index: 0, classification: 'SUPPORTS', reason: 'Direct preference match.' },
                  { index: 1, classification: 'NEUTRAL', reason: 'Unrelated preference.' },
                ]),
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Stored memories directly indicate the user prefers dark mode.',
              },
            },
          ],
        }),
      }));

    const { validateRoutes } = await import('./routes.js');
    const app = await buildTestApp();
    await app.register(validateRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/validate',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        claim: 'The user prefers dark mode',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.verdict).toBe('supported');
    expect(body.data.supporting).toHaveLength(1);
    expect(body.data.contradicting).toHaveLength(0);
    expect(body.data.confidence).toBeCloseTo(0.92, 5);
  });

  it('returns contradicted verdict when contradiction is found and no support exists', async () => {
    mockQueryMemories.mockResolvedValue([
      makeMemoryResult('33333333-3333-4333-8333-333333333333', 'User prefers light mode', 0.9),
    ]);

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { index: 0, classification: 'CONTRADICTS', reason: 'States opposite preference.' },
                ]),
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'The retrieved memory states the opposite preference, so the claim is contradicted.',
              },
            },
          ],
        }),
      }));

    const { validateRoutes } = await import('./routes.js');
    const app = await buildTestApp();
    await app.register(validateRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/validate',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        claim: 'The user prefers dark mode',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.verdict).toBe('contradicted');
    expect(body.data.supporting).toHaveLength(0);
    expect(body.data.contradicting).toHaveLength(1);
  });

  it('returns unverified verdict when no relevant memories are found', async () => {
    mockQueryMemories.mockResolvedValue([]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'No retrieved memory supports or contradicts the claim.',
            },
          },
        ],
      }),
    }));

    const { validateRoutes } = await import('./routes.js');
    const app = await buildTestApp();
    await app.register(validateRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/validate',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        claim: 'The user prefers dark mode',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.verdict).toBe('unverified');
    expect(body.data.confidence).toBe(0);
    expect(body.data.supporting).toHaveLength(0);
    expect(body.data.contradicting).toHaveLength(0);
  });

  it('rejects invalid input schema', async () => {
    const { validateRoutes } = await import('./routes.js');
    const app = await buildTestApp();
    await app.register(validateRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/validate',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        claim: '',
        k: 100,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});
