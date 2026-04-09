import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../common/config/index.js';
import { OpenAIEmbeddingsProvider } from '../../common/embeddings/index.js';
import { runIngestPipeline } from './service.js';
import { ingestRequestSchema } from './schemas.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

export async function ingestRoutes(fastify: FastifyInstance) {
  fastify.post('/ingest', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = ingestRequestSchema.parse(request.body);

      const embeddingsProvider = env.OPENAI_API_KEY
        ? new OpenAIEmbeddingsProvider(env.OPENAI_API_KEY)
        : undefined;

      const result = await runIngestPipeline(tenantId, input, embeddingsProvider, {
        logger: request.log,
      });

      return reply.status(200).send({
        data: {
          success: result.success,
          traceId: result.traceId,
          summary: result.summary,
          acceptedMemories: result.acceptedMemories,
          rejectedMemories: result.rejectedMemories,
          warnings: result.warnings,
          ...(result.sessionSummary ? { sessionSummary: result.sessionSummary } : {}),
          ...(input.debug ? { debug: result.debug } : {}),
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

      if (
        error instanceof Error &&
        (error.message === 'Normalized content must be at least 10 characters' ||
          error.message.includes('OPENAI_API_KEY'))
      ) {
        request.log.warn({ err: error }, 'Ingest request rejected');
        return reply.status(400).send({
          error: {
            code: 'INVALID_INGEST_REQUEST',
            message: error.message,
          },
        });
      }

      request.log.error({ err: error }, 'Ingest request failed');
      throw error;
    }
  });
}
