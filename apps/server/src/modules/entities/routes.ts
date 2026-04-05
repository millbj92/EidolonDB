import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createEntitySchema } from './schemas.js';
import { createEntity, getEntityById } from './service.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

export async function entitiesRoutes(fastify: FastifyInstance) {
  // Create entity
  fastify.post('/entities', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = createEntitySchema.parse(request.body);
      const entity = await createEntity(tenantId, input);

      return reply.status(201).send({
        data: {
          id: entity.id,
          tenantId: entity.tenantId,
          type: entity.type,
          name: entity.name,
          properties: entity.properties,
          primaryArtifactId: entity.primaryArtifactId,
          tags: entity.tags,
          createdAt: entity.createdAt.toISOString(),
          updatedAt: entity.updatedAt.toISOString(),
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

  // Get entity by ID
  fastify.get<{ Params: { id: string } }>('/entities/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const entity = await getEntityById(tenantId, id);

      if (!entity) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Entity with id ${id} not found`,
          },
        });
      }

      return reply.status(200).send({
        data: {
          id: entity.id,
          tenantId: entity.tenantId,
          type: entity.type,
          name: entity.name,
          properties: entity.properties,
          primaryArtifactId: entity.primaryArtifactId,
          tags: entity.tags,
          createdAt: entity.createdAt.toISOString(),
          updatedAt: entity.updatedAt.toISOString(),
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
}
