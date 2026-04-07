import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  listRetrievalStatsQuerySchema,
  markUsedRequestSchema,
} from './schemas.js';
import { getRetrievalStats, listRetrievalStats, markUsed } from './service.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.post('/feedback/mark-used', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = markUsedRequestSchema.parse(request.body);
      const result = await markUsed(tenantId, input);
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

  fastify.get<{ Params: { memoryId: string } }>('/feedback/stats/:memoryId', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { memoryId } = request.params;
      const stats = await getRetrievalStats(tenantId, memoryId);
      return reply.status(200).send({ data: stats });
    } catch (error) {
      if (error instanceof Error && error.message === 'x-tenant-id header is required') {
        return reply.status(400).send({
          error: {
            code: 'MISSING_TENANT_ID',
            message: error.message,
          },
        });
      }
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
      }
      throw error;
    }
  });

  fastify.get('/feedback/stats', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const query = listRetrievalStatsQuerySchema.parse(request.query);
      const stats = await listRetrievalStats(tenantId, query);
      return reply.status(200).send({ data: { stats } });
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
