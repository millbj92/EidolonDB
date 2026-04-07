import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createArtifactSchema } from './schemas.js';
import { createArtifact, getArtifactById, deleteArtifactCascade } from './service.js';
import { chunkText } from '../../common/utils/index.js';
import { OpenAIEmbeddingsProvider } from '../../common/embeddings/index.js';
import { createMemoriesBatch, type CreateMemoryInput } from '../memories/index.js';
import { env } from '../../common/config/index.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

export async function artifactsRoutes(fastify: FastifyInstance) {
  // Create artifact
  fastify.post('/artifacts', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = createArtifactSchema.parse(request.body);

      // Create the artifact
      const artifact = await createArtifact(tenantId, {
        kind: input.kind,
        mimeType: input.mimeType,
        content: input.content,
        metadata: input.metadata,
        tags: input.tags,
      });

      const response: {
        artifact: {
          id: string;
          tenantId: string;
          kind: string;
          mimeType: string;
          content: string;
          metadata: Record<string, unknown>;
          tags: string[];
          createdAt: string;
          updatedAt: string;
        };
        memories?: Array<{
          id: string;
          content: string;
          embeddingId: string | null;
        }>;
      } = {
        artifact: {
          id: artifact.id,
          tenantId: artifact.tenantId,
          kind: artifact.kind,
          mimeType: artifact.mimeType,
          content: artifact.content,
          metadata: artifact.metadata ?? {},
          tags: artifact.tags ?? [],
          createdAt: artifact.createdAt.toISOString(),
          updatedAt: artifact.updatedAt.toISOString(),
        },
      };

      // Auto-process if requested
      if (input.autoProcess) {
        const { chunkSize, chunkOverlap, generateEmbeddings, ownerEntityId, memoryTier } = input.autoProcess;

        // Chunk the content
        const chunks = chunkText(input.content, { chunkSize, chunkOverlap });

        // Prepare memory inputs
        const memoryInputs: CreateMemoryInput[] = chunks.map((chunk, idx) => ({
          ownerEntityId,
          tier: memoryTier,
          content: chunk.content,
          sourceArtifactId: artifact.id,
          importanceScore: 0.5,
          metadata: {
            chunkIndex: idx,
            startChar: chunk.startChar,
            endChar: chunk.endChar,
          },
          tags: [],
        }));

        // Create embeddings provider if needed
        let embeddingsProvider: OpenAIEmbeddingsProvider | undefined;
        if (generateEmbeddings && env.OPENAI_API_KEY) {
          embeddingsProvider = new OpenAIEmbeddingsProvider();
        }

        // Create memories (with embeddings if provider available)
        const memoriesWithEmbeddings = await createMemoriesBatch(tenantId, memoryInputs, {
          generateEmbedding: generateEmbeddings && !!embeddingsProvider,
          embeddingsProvider,
        });

        response.memories = memoriesWithEmbeddings.map((m) => ({
          id: m.memory.id,
          content: m.memory.content,
          embeddingId: m.embeddingId,
        }));
      }

      return reply.status(201).send({ data: response });
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

  // Get artifact by ID
  fastify.get<{ Params: { id: string } }>('/artifacts/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const artifact = await getArtifactById(tenantId, id);

      if (!artifact) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Artifact with id ${id} not found`,
          },
        });
      }

      return reply.status(200).send({
        data: {
          id: artifact.id,
          tenantId: artifact.tenantId,
          kind: artifact.kind,
          mimeType: artifact.mimeType,
          content: artifact.content,
          metadata: artifact.metadata ?? {},
          tags: artifact.tags ?? [],
          createdAt: artifact.createdAt.toISOString(),
          updatedAt: artifact.updatedAt.toISOString(),
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

  // Delete artifact with cascade cleanup
  fastify.delete<{ Params: { id: string } }>('/artifacts/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const result = await deleteArtifactCascade(tenantId, id);

      if (!result.deleted) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Artifact with id ${id} not found`,
          },
        });
      }

      return reply.status(200).send({
        data: {
          deleted: true,
          memoriesDeleted: result.memoriesDeleted,
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
