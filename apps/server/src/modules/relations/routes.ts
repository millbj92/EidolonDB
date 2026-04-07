import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  createRelationSchema,
  listRelationsQuerySchema,
  traverseRelationsQuerySchema,
} from './schemas.js';
import {
  createRelation,
  deleteRelation,
  getRelationById,
  listRelations,
  traverseRelations,
} from './service.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

function relationToResponse(relation: {
  id: string;
  tenantId: string;
  type: string;
  fromType: 'entity' | 'artifact' | 'memory';
  fromId: string;
  toType: 'entity' | 'artifact' | 'memory';
  toId: string;
  weight: number | null;
  properties: Record<string, unknown> | null;
  tags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: relation.id,
    tenantId: relation.tenantId,
    type: relation.type,
    fromType: relation.fromType,
    fromId: relation.fromId,
    toType: relation.toType,
    toId: relation.toId,
    weight: relation.weight,
    properties: relation.properties ?? {},
    tags: relation.tags ?? [],
    createdAt: relation.createdAt.toISOString(),
    updatedAt: relation.updatedAt.toISOString(),
  };
}

export async function relationsRoutes(fastify: FastifyInstance) {
  // Create relation
  fastify.post('/relations', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = createRelationSchema.parse(request.body);
      const relation = await createRelation(tenantId, input);

      return reply.status(201).send({
        data: relationToResponse(relation),
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

  // Traverse relations graph
  fastify.get('/relations/traverse', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = traverseRelationsQuerySchema.parse(request.query);
      const result = await traverseRelations(tenantId, input);
      return reply.status(200).send({ data: result });
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

  // List/query relations
  fastify.get('/relations', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const query = listRelationsQuerySchema.parse(request.query);
      const result = await listRelations(tenantId, query);

      return reply.status(200).send({
        data: {
          relations: result.relations.map(relationToResponse),
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

  // Get relation by ID
  fastify.get<{ Params: { id: string } }>('/relations/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const relation = await getRelationById(tenantId, id);

      if (!relation) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Relation with id ${id} not found`,
          },
        });
      }

      return reply.status(200).send({
        data: relationToResponse(relation),
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

  // Delete relation
  fastify.delete<{ Params: { id: string } }>('/relations/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const deleted = await deleteRelation(tenantId, id);

      if (!deleted) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Relation with id ${id} not found`,
          },
        });
      }

      return reply.status(200).send({
        data: { deleted: true },
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
}
