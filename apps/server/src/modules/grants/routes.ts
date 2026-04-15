import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createGrantSchema, listGrantsQuerySchema } from './schemas.js';
import {
  createGrant,
  deleteGrant,
  DuplicateGrantError,
  getGrantById,
  listGrants,
} from './service.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

function grantToResponse(grant: {
  id: string;
  tenantId: string;
  ownerEntityId: string;
  granteeEntityId: string | null;
  permission: 'read' | 'read-write';
  scopeTier: 'short_term' | 'episodic' | 'semantic' | null;
  scopeTag: string | null;
  createdAt: Date;
}) {
  return {
    id: grant.id,
    tenantId: grant.tenantId,
    ownerEntityId: grant.ownerEntityId,
    granteeEntityId: grant.granteeEntityId,
    permission: grant.permission,
    scopeTier: grant.scopeTier,
    scopeTag: grant.scopeTag,
    createdAt: grant.createdAt.toISOString(),
  };
}

export async function grantsRoutes(fastify: FastifyInstance) {
  fastify.post('/grants', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = createGrantSchema.parse(request.body);
      const grant = await createGrant(tenantId, input);
      return reply.status(201).send({ data: grantToResponse(grant) });
    } catch (error) {
      if (error instanceof Error && error.message === 'x-tenant-id header is required') {
        return reply.status(400).send({
          error: {
            code: 'MISSING_TENANT_ID',
            message: error.message,
          },
        });
      }

      if (error instanceof DuplicateGrantError) {
        return reply.status(409).send({
          error: {
            code: 'DUPLICATE_GRANT',
            message: error.message,
          },
        });
      }

      throw error;
    }
  });

  fastify.get('/grants', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const query = listGrantsQuerySchema.parse(request.query);
      const result = await listGrants(tenantId, query);

      return reply.status(200).send({
        data: {
          grants: result.grants.map(grantToResponse),
          total: result.total,
          offset: result.offset,
          limit: result.limit,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'x-tenant-id header is required') {
        return reply.status(400).send({
          error: {
            code: 'MISSING_TENANT_ID',
            message: error.message,
          },
        });
      }

      throw error;
    }
  });

  fastify.get<{ Params: { id: string } }>('/grants/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const grant = await getGrantById(tenantId, id);

      if (!grant) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Grant with id ${id} not found`,
          },
        });
      }

      return reply.status(200).send({ data: grantToResponse(grant) });
    } catch (error) {
      if (error instanceof Error && error.message === 'x-tenant-id header is required') {
        return reply.status(400).send({
          error: {
            code: 'MISSING_TENANT_ID',
            message: error.message,
          },
        });
      }

      throw error;
    }
  });

  fastify.delete<{ Params: { id: string } }>('/grants/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const deleted = await deleteGrant(tenantId, id);

      if (!deleted) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Grant with id ${id} not found`,
          },
        });
      }

      return reply.status(200).send({ data: { deleted: true } });
    } catch (error) {
      if (error instanceof Error && error.message === 'x-tenant-id header is required') {
        return reply.status(400).send({
          error: {
            code: 'MISSING_TENANT_ID',
            message: error.message,
          },
        });
      }

      throw error;
    }
  });
}
