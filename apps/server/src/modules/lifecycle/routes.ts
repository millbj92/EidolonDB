import type { FastifyInstance, FastifyRequest } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, lifecycleRuns } from '../../common/db/index.js';
import { runLifecycle } from './service.js';
import { lifecycleRunRequestSchema } from './schemas.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

const lifecycleRunsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

export async function lifecycleRoutes(fastify: FastifyInstance) {
  fastify.post('/lifecycle/run', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = lifecycleRunRequestSchema.parse(request.body);
      const result = await runLifecycle(tenantId, {
        dryRun: input.dryRun,
        triggeredBy: input.triggeredBy,
        logger: request.log,
      });

      return reply.status(200).send(result);
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

  fastify.get('/lifecycle/runs', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { limit } = lifecycleRunsQuerySchema.parse(request.query);

      const runs = await db
        .select()
        .from(lifecycleRuns)
        .where(eq(lifecycleRuns.tenantId, tenantId))
        .orderBy(desc(lifecycleRuns.createdAt))
        .limit(limit);

      return reply.status(200).send({
        runs: runs.map((run) => ({
          ...run,
          completedAt: run.completedAt?.toISOString() ?? null,
          createdAt: run.createdAt.toISOString(),
        })),
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
