import type { FastifyInstance, FastifyRequest } from 'fastify';
import { contextBuildSchema } from './schemas.js';
import { buildContext } from './service.js';
import { OpenAIEmbeddingsProvider } from '../../common/embeddings/index.js';
import { env } from '../../common/config/index.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

export async function contextRoutes(fastify: FastifyInstance) {
  // Build context
  fastify.post('/context/build', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = contextBuildSchema.parse(request.body);

      // Create embeddings provider for semantic search
      let embeddingsProvider: OpenAIEmbeddingsProvider | undefined;
      if (env.OPENAI_API_KEY) {
        embeddingsProvider = new OpenAIEmbeddingsProvider();
      }

      const result = await buildContext(tenantId, input, { embeddingsProvider });

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
