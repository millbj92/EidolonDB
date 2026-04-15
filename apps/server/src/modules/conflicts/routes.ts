import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../common/config/index.js';
import { db, memories } from '../../common/db/index.js';
import { OpenAIEmbeddingsProvider } from '../../common/embeddings/index.js';
import { detectConflict, resolveConflict } from './conflictService.js';
import { detectConflictsSchema, resolveConflictSchema } from './schemas.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

export async function conflictsRoutes(fastify: FastifyInstance) {
  fastify.post('/conflicts/detect', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = detectConflictsSchema.parse(request.body);
      const embeddingsProvider = env.OPENAI_API_KEY ? new OpenAIEmbeddingsProvider() : undefined;
      const scannedMemories = await db
        .select()
        .from(memories)
        .where(and(eq(memories.tenantId, tenantId), eq(memories.conflictStatus, 'none')))
        .orderBy(desc(memories.createdAt))
        .limit(input.limit);

      const memoryMap = new Map(scannedMemories.map((memory) => [memory.id, memory]));
      const seenPairs = new Set<string>();
      const conflicts: Array<{
        memoryIdA: string;
        contentA: string;
        memoryIdB: string;
        contentB: string;
        confidence: number;
        explanation: string;
        status: 'flagged' | 'resolved';
        resolution: 'newer-wins' | 'higher-importance' | 'merge' | 'manual' | null;
      }> = [];

      let autoResolved = 0;

      for (const memory of scannedMemories) {
        const result = await detectConflict(tenantId, memory.content, embeddingsProvider, {
          excludeMemoryId: memory.id,
        });

        if (!result.isConflict || !result.conflictingMemoryId) {
          continue;
        }

        const other = memoryMap.get(result.conflictingMemoryId)
          ?? await db
            .select()
            .from(memories)
            .where(and(eq(memories.tenantId, tenantId), eq(memories.id, result.conflictingMemoryId)))
            .limit(1)
            .then((rows) => rows[0]);

        if (!other) {
          continue;
        }

        const pairKey = [memory.id, other.id].sort().join(':');
        if (seenPairs.has(pairKey)) {
          continue;
        }
        seenPairs.add(pairKey);

        const strategy = input.autoResolve ? input.strategy : 'manual';
        const resolution = await resolveConflict(tenantId, memory.id, other.id, strategy);
        if (resolution.status === 'resolved') {
          autoResolved += 1;
        }

        conflicts.push({
          memoryIdA: memory.id,
          contentA: memory.content,
          memoryIdB: other.id,
          contentB: other.content,
          confidence: result.confidence ?? 0,
          explanation: result.explanation ?? '',
          status: resolution.status,
          resolution: resolution.status === 'resolved' ? strategy : null,
        });
      }

      return reply.status(200).send({
        data: {
          scanned: scannedMemories.length,
          conflictsFound: conflicts.length,
          autoResolved,
          conflicts,
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

  fastify.post('/conflicts/resolve', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = resolveConflictSchema.parse(request.body);
      const result = await resolveConflict(
        tenantId,
        input.memoryIdA,
        input.memoryIdB,
        input.strategy
      );

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
}
