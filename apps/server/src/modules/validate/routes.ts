import type { FastifyInstance, FastifyRequest } from 'fastify';
import { validateRequestSchema } from './schemas.js';
import { validateClaim } from './service.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

export async function validateRoutes(fastify: FastifyInstance) {
  fastify.post('/validate', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = validateRequestSchema.parse(request.body);

      const result = await validateClaim(tenantId, input);

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
}
