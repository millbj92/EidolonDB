import type { FastifyInstance, FastifyRequest } from 'fastify';
import { listMemoriesQuerySchema, memoryQuerySchema, updateMemorySchema } from './schemas.js';
import {
  queryMemories,
  getMemoryById,
  listMemories,
  updateMemory,
  deleteMemory,
  recordMemoryAccess,
  recordMemoryRetrievals,
  getMemoryStats,
} from './service.js';
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
  // List memories (paginated)
  fastify.get('/memories', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const query = listMemoriesQuerySchema.parse(request.query);
      const result = await listMemories(tenantId, query);

      return reply.status(200).send({
        data: {
          memories: result.memories.map((memory) => ({
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
          })),
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

      void recordMemoryRetrievals(tenantId, {
        queryText: input.text,
        sessionId: input.sessionId,
        actorId: input.actorId,
        retrievals: results.map((result) => ({
          memoryId: result.memory.id,
          retrievalScore: result.score,
        })),
      }).catch((error: unknown) => {
        fastify.log.warn({ err: error, tenantId }, 'Failed to record memory retrieval events');
      });

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

  // Aggregate memory stats
  fastify.get('/memories/stats', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const stats = await getMemoryStats(tenantId);
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

  // Update memory
  fastify.patch<{ Params: { id: string } }>('/memories/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const input = updateMemorySchema.parse(request.body);
      const memory = await updateMemory(tenantId, id, input);

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

  // Delete memory
  fastify.delete<{ Params: { id: string } }>('/memories/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const deleted = await deleteMemory(tenantId, id);

      if (!deleted) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Memory with id ${id} not found`,
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

  // Record memory access
  fastify.post<{ Params: { id: string } }>('/memories/:id/access', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const memory = await recordMemoryAccess(tenantId, id);

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
