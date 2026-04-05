import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './common/config/index.js';
import { healthRoutes } from './modules/health/index.js';
import { entitiesRoutes } from './modules/entities/index.js';
import { artifactsRoutes } from './modules/artifacts/index.js';
import { memoriesRoutes } from './modules/memories/index.js';
import { contextRoutes } from './modules/context/index.js';

async function main() {
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: true,
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(entitiesRoutes);
  await fastify.register(artifactsRoutes);
  await fastify.register(memoriesRoutes);
  await fastify.register(contextRoutes);

  // Global error handler
  fastify.setErrorHandler((error: Error, _request, reply) => {
    fastify.log.error(error);

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error,
        },
      });
    }

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  // Start server
  try {
    await fastify.listen({ port: env.PORT, host: env.HOST });
    fastify.log.info(`EidolonDB server listening on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
