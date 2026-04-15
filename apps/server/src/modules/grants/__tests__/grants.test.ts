import Fastify, { type FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAnd,
  mockEq,
  mockIsNull,
  mockOr,
  mockSql,
  mockDbSelect,
  mockDbInsert,
  mockDbDelete,
  mockInsertValues,
  mockInsertReturning,
  mockDeleteWhere,
  mockDeleteReturning,
} = vi.hoisted(() => ({
  mockAnd: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  mockEq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  mockIsNull: vi.fn((arg: unknown) => ({ op: 'isNull', arg })),
  mockOr: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  mockSql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    { raw: vi.fn((value: string) => ({ raw: value })) }
  ),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbDelete: vi.fn(),
  mockInsertValues: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockDeleteReturning: vi.fn(),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: mockAnd,
    eq: mockEq,
    isNull: mockIsNull,
    or: mockOr,
    sql: mockSql,
  };
});

vi.mock('../../../common/db/client.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    delete: mockDbDelete,
  },
}));

vi.mock('../../../common/db/schema.js', () => ({
  memoryGrants: {
    id: 'id',
    tenantId: 'tenant_id',
    ownerEntityId: 'owner_entity_id',
    granteeEntityId: 'grantee_entity_id',
    permission: 'permission',
    scopeTier: 'scope_tier',
    scopeTag: 'scope_tag',
    createdAt: 'created_at',
  },
}));

function makeSelectBuilder() {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    offset: vi.fn(),
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

describe('grants service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockDbInsert.mockImplementation(() => ({
      values: mockInsertValues,
    }));
    mockInsertValues.mockImplementation(() => ({
      returning: mockInsertReturning,
    }));

    mockDbDelete.mockImplementation(() => ({
      where: mockDeleteWhere,
    }));
    mockDeleteWhere.mockImplementation(() => ({
      returning: mockDeleteReturning,
    }));
  });

  it('createGrant creates a grant and returns it', async () => {
    const created = {
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: 'tenant-1',
      ownerEntityId: '22222222-2222-4222-8222-222222222222',
      granteeEntityId: null,
      permission: 'read' as const,
      scopeTier: null,
      scopeTag: null,
      createdAt: new Date('2026-04-15T00:00:00.000Z'),
    };

    const duplicateCheckBuilder = makeSelectBuilder();
    duplicateCheckBuilder.limit.mockResolvedValueOnce([]);
    mockDbSelect.mockReturnValueOnce(duplicateCheckBuilder);
    mockInsertReturning.mockResolvedValueOnce([created]);

    const { createGrant } = await import('../service.js');
    const result = await createGrant('tenant-1', {
      ownerEntityId: created.ownerEntityId,
      granteeEntityId: null,
      permission: 'read',
      scopeTier: null,
      scopeTag: null,
    });

    expect(result).toEqual(created);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });

  it('listGrants filters by ownerEntityId', async () => {
    const totalBuilder = makeSelectBuilder();
    totalBuilder.where.mockResolvedValueOnce([{ count: 1 }]);

    const listBuilder = makeSelectBuilder();
    listBuilder.limit.mockReturnThis();
    listBuilder.offset.mockResolvedValueOnce([
      {
        id: '33333333-3333-4333-8333-333333333333',
        tenantId: 'tenant-1',
        ownerEntityId: '44444444-4444-4444-8444-444444444444',
        granteeEntityId: null,
        permission: 'read',
        scopeTier: null,
        scopeTag: null,
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
      },
    ]);

    mockDbSelect
      .mockReturnValueOnce(totalBuilder)
      .mockReturnValueOnce(listBuilder);

    const { listGrants } = await import('../service.js');
    const result = await listGrants('tenant-1', {
      ownerEntityId: '44444444-4444-4444-8444-444444444444',
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.grants).toHaveLength(1);
    expect(mockEq).toHaveBeenCalledWith('owner_entity_id', '44444444-4444-4444-8444-444444444444');
  });

  it('deleteGrant removes the grant', async () => {
    mockDeleteReturning.mockResolvedValueOnce([{ id: '55555555-5555-4555-8555-555555555555' }]);

    const { deleteGrant } = await import('../service.js');
    const deleted = await deleteGrant('tenant-1', '55555555-5555-4555-8555-555555555555');

    expect(deleted).toBe(true);
  });

  it('getGrantsForGrantee returns both direct and broadcast grants', async () => {
    const listBuilder = makeSelectBuilder();
    listBuilder.where.mockResolvedValueOnce([
      {
        id: '66666666-6666-4666-8666-666666666666',
        tenantId: 'tenant-1',
        ownerEntityId: '77777777-7777-4777-8777-777777777777',
        granteeEntityId: '88888888-8888-4888-8888-888888888888',
        permission: 'read',
        scopeTier: null,
        scopeTag: null,
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
      },
      {
        id: '99999999-9999-4999-8999-999999999999',
        tenantId: 'tenant-1',
        ownerEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        granteeEntityId: null,
        permission: 'read',
        scopeTier: null,
        scopeTag: null,
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
      },
    ]);
    mockDbSelect.mockReturnValueOnce(listBuilder);

    const { getGrantsForGrantee } = await import('../service.js');
    const grants = await getGrantsForGrantee('tenant-1', '88888888-8888-4888-8888-888888888888');

    expect(grants).toHaveLength(2);
    expect(mockOr).toHaveBeenCalledTimes(1);
    expect(mockIsNull).toHaveBeenCalledWith('grantee_entity_id');
  });
});

describe('grants routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('duplicate grant returns 409', async () => {
    vi.doMock('../service.js', () => {
      class DuplicateGrantError extends Error {
        constructor() {
          super('Grant already exists for the same owner/grantee/tier/tag scope');
          this.name = 'DuplicateGrantError';
        }
      }

      return {
        createGrant: vi.fn().mockRejectedValue(new DuplicateGrantError()),
        listGrants: vi.fn(),
        getGrantById: vi.fn(),
        deleteGrant: vi.fn(),
        DuplicateGrantError,
      };
    });

    const { grantsRoutes } = await import('../routes.js');
    const app = await buildTestApp();
    await app.register(grantsRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/grants',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
      payload: {
        ownerEntityId: '22222222-2222-4222-8222-222222222222',
        granteeEntityId: null,
        permission: 'read',
        scopeTier: null,
        scopeTag: null,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('DUPLICATE_GRANT');
    await app.close();
  });
});
