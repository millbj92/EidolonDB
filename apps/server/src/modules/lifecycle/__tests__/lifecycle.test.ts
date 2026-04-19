import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockListMemories,
  mockCreateMemory,
  mockUpdateMemory,
  mockDeleteMemory,
  mockCreateRelation,
  mockDbExecute,
  mockDbInsert,
  mockInsertValues,
  mockInsertReturning,
} = vi.hoisted(() => ({
  mockListMemories: vi.fn(),
  mockCreateMemory: vi.fn(),
  mockUpdateMemory: vi.fn(),
  mockDeleteMemory: vi.fn(),
  mockCreateRelation: vi.fn(),
  mockDbExecute: vi.fn(),
  mockDbInsert: vi.fn(),
  mockInsertValues: vi.fn(),
  mockInsertReturning: vi.fn(),
}));

mockDbInsert.mockImplementation(() => ({
  values: mockInsertValues,
}));

mockInsertValues.mockImplementation(() => ({
  returning: mockInsertReturning,
}));

vi.mock('../../../common/db/index.js', () => ({
  db: {
    execute: mockDbExecute,
    insert: mockDbInsert,
  },
  lifecycleRuns: {
    id: 'id',
  },
}));

vi.mock('../../memories/index.js', () => ({
  listMemories: mockListMemories,
  createMemory: mockCreateMemory,
  updateMemory: mockUpdateMemory,
  deleteMemory: mockDeleteMemory,
}));

vi.mock('../../relations/index.js', () => ({
  createRelation: mockCreateRelation,
}));

import { runLifecycle } from '../service.js';

interface MemoryLike {
  id: string;
  tier: 'short_term' | 'episodic' | 'semantic';
  createdAt: Date;
  accessCount: number | null;
  importanceScore: number | null;
  content: string;
  ownerEntityId: string | null;
  sourceArtifactId: string | null;
  sourceEventId: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
}

function makeMemory(overrides: Partial<MemoryLike>): MemoryLike {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tier: 'short_term',
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    accessCount: 0,
    importanceScore: 0.5,
    content: 'Memory content',
    ownerEntityId: null,
    sourceArtifactId: null,
    sourceEventId: null,
    tags: [],
    metadata: {},
    ...overrides,
  };
}

function mockMemories(mems: MemoryLike[]) {
  mockListMemories.mockResolvedValue({
    memories: mems,
    total: mems.length,
    offset: 0,
    limit: 500,
  });
}

function mockDistillationFetch(confidence = 0.9) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                distilledContent: 'Codex CLI login credentials should be stored internally.',
                confidence,
                rationale: 'Durable operational guidance',
              }),
            },
          },
        ],
      }),
    })
  );
}

describe('runLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    mockInsertReturning.mockResolvedValue([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    ]);
    mockCreateMemory.mockResolvedValue({
      memory: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      embeddingId: null,
    });
    mockUpdateMemory.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
    mockDeleteMemory.mockResolvedValue(true);
    mockCreateRelation.mockResolvedValue({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
    mockDbExecute.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('expires short_term memory older than 24h with 0 access', async () => {
    mockMemories([
      makeMemory({
        tier: 'short_term',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        accessCount: 0,
      }),
    ]);

    const result = await runLifecycle('tenant-1');

    expect(result.summary.expired).toBe(1);
    expect(result.details[0]?.action).toBe('expired');
    expect(mockDeleteMemory).toHaveBeenCalledTimes(1);
  });

  it('promotes short_term memory older than 24h with accessCount >= 2', async () => {
    mockMemories([
      makeMemory({
        tier: 'short_term',
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
        accessCount: 2,
      }),
    ]);

    const result = await runLifecycle('tenant-1');

    expect(result.summary.promoted).toBe(1);
    expect(result.details[0]?.action).toBe('promoted');
    expect(mockUpdateMemory).toHaveBeenCalledWith('tenant-1', '11111111-1111-4111-8111-111111111111', {
      tier: 'episodic',
    });
  });

  it('archives episodic memory older than 30d with 0 access', async () => {
    mockMemories([
      makeMemory({
        tier: 'episodic',
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        accessCount: 0,
      }),
    ]);

    const result = await runLifecycle('tenant-1');

    expect(result.summary.archived).toBe(1);
    expect(result.details[0]?.action).toBe('archived');
    expect(mockDeleteMemory).toHaveBeenCalledTimes(1);
  });

  it('distills episodic memory older than 7d with high importance and access', async () => {
    mockMemories([
      makeMemory({
        tier: 'episodic',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        accessCount: 3,
        importanceScore: 0.9,
      }),
    ]);
    mockDistillationFetch(0.92);

    const result = await runLifecycle('tenant-1');

    expect(result.summary.distilled).toBe(1);
    expect(result.details[0]?.action).toBe('distilled');
    expect(result.details[0]?.newMemoryId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(mockCreateMemory).toHaveBeenCalledTimes(1);
    expect(mockCreateRelation).toHaveBeenCalledTimes(1);
  });

  it('keeps episodic memory unchanged when importance is below 0.7', async () => {
    mockMemories([
      makeMemory({
        tier: 'episodic',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        accessCount: 3,
        importanceScore: 0.6,
      }),
    ]);

    const result = await runLifecycle('tenant-1');

    expect(result.summary.unchanged).toBe(1);
    expect(result.details[0]?.action).toBe('unchanged');
    expect(mockCreateMemory).not.toHaveBeenCalled();
  });

  it('keeps semantic memory unchanged', async () => {
    mockMemories([
      makeMemory({
        tier: 'semantic',
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      }),
    ]);

    const result = await runLifecycle('tenant-1');

    expect(result.summary.unchanged).toBe(1);
    expect(result.details[0]?.action).toBe('unchanged');
    expect(mockDeleteMemory).not.toHaveBeenCalled();
    expect(mockUpdateMemory).not.toHaveBeenCalled();
  });

  it('supports dryRun without mutations while still returning actions', async () => {
    mockMemories([
      makeMemory({
        tier: 'short_term',
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
        accessCount: 0,
      }),
    ]);

    const result = await runLifecycle('tenant-1', { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.summary.expired).toBe(1);
    expect(result.details[0]?.action).toBe('expired');
    expect(mockDeleteMemory).not.toHaveBeenCalled();
    expect(mockUpdateMemory).not.toHaveBeenCalled();
    expect(mockCreateMemory).not.toHaveBeenCalled();
    expect(mockCreateRelation).not.toHaveBeenCalled();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it('keeps memory unchanged when distillation confidence is below 0.5', async () => {
    mockMemories([
      makeMemory({
        tier: 'episodic',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        accessCount: 3,
        importanceScore: 0.9,
      }),
    ]);
    mockDistillationFetch(0.4);

    const result = await runLifecycle('tenant-1');

    expect(result.summary.unchanged).toBe(1);
    expect(result.summary.distilled).toBe(0);
    expect(result.details[0]?.action).toBe('unchanged');
    expect(mockCreateMemory).not.toHaveBeenCalled();
  });

  it('records distillation failure as error and continues with memory unchanged', async () => {
    mockMemories([
      makeMemory({
        id: '11111111-1111-4111-8111-111111111111',
        tier: 'episodic',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        accessCount: 3,
        importanceScore: 0.9,
      }),
      makeMemory({
        id: '22222222-2222-4222-8222-222222222222',
        tier: 'semantic',
      }),
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'upstream error',
      })
    );

    const result = await runLifecycle('tenant-1');

    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('OpenAI distillation failed: 500');
    expect(result.summary.unchanged).toBe(2);
    expect(result.details[0]?.action).toBe('unchanged');
    expect(result.details[1]?.action).toBe('unchanged');
  });

  it('skips distillation for episodic memory that has already been distilled', async () => {
    mockMemories([
      makeMemory({
        tier: 'episodic',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        accessCount: 3,
        importanceScore: 0.9,
        metadata: {
          distilledAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          distilledMemoryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        },
      }),
    ]);
    mockDistillationFetch(0.92);

    const result = await runLifecycle('tenant-1');

    expect(result.summary.unchanged).toBe(1);
    expect(result.summary.distilled).toBe(0);
    expect(result.details[0]?.action).toBe('unchanged');
    expect(result.details[0]?.reason).toContain('already distilled');
    expect(mockCreateMemory).not.toHaveBeenCalled();
    expect(mockCreateRelation).not.toHaveBeenCalled();
  });

  it('always inserts lifecycle_runs record', async () => {
    mockMemories([
      makeMemory({
        tier: 'semantic',
      }),
    ]);

    await runLifecycle('tenant-1');

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    expect(mockInsertReturning).toHaveBeenCalledTimes(1);
  });
});
