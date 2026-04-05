import type { FastifyInstance, FastifyRequest } from 'fastify';
import { memoryQuerySchema } from './schemas.js';
import { queryMemories, getMemoryById } from './service.js';
import { OpenAIEmbeddingsProvider } from '../../common/embeddings/index.js';
import { env } from '../../common/config/index.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

export async function memoriesRoutes(fastify: FastifyInstance) {
  // Query memories
  fastify.post('/memories/query', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = memoryQuerySchema.parse(request.body);

      // Create embeddings provider if needed for vector search
      let embeddingsProvider: OpenAIEmbeddingsProvider | undefined;
      if (input.text && env.OPENAI_API_KEY) {
        embeddingsProvider = new OpenAIEmbeddingsProvider();
      }

      const results = await queryMemories(tenantId, input, { embeddingsProvider });

      return reply.status(200).send({
        data: {
          results,
          query: {
            text: input.text,
            k: input.k,
          },
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

  // Get memory by ID
  fastify.get<{ Params: { id: string } }>('/memories/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const memory = await getMemoryById(tenantId, id);

      if (!memory) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Memory with id ${id} not found`,
          },
        });
      }

      return reply.status(200).send({
        data: {
          id: memory.id,
          tenantId: memory.tenantId,
          ownerEntityId: memory.ownerEntityId,
          tier: memory.tier,
          content: memory.content,
          sourceArtifactId: memory.sourceArtifactId,
          sourceEventId: memory.sourceEventId,
          embeddingId: memory.embeddingId,
          importanceScore: memory.importanceScore,
          recencyScore: memory.recencyScore,
          accessCount: memory.accessCount,
          lastAccessedAt: memory.lastAccessedAt?.toISOString() ?? null,
          metadata: memory.metadata ?? {},
          tags: memory.tags ?? [],
          createdAt: memory.createdAt.toISOString(),
          updatedAt: memory.updatedAt.toISOString(),
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
