import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config.js';
import { checkQuota, currentMonthKey, getPlanRpm, incrementOps, lookupApiKey } from './db/queries.js';

type RequestWithTenant = {
  tenantId: string;
  tenantSlug: string;
  plan: string;
  isServiceKey?: boolean;
};

const planRateState = new Map<string, { count: number; windowStart: number }>();

function extractRawApiKey(headerValue?: string): string | null {
  if (!headerValue) {
    return null;
  }

  const normalized = headerValue.trim();
  if (!normalized.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = normalized.slice(7).trim();
  return token.length > 0 ? token : null;
}

function checkPlanRateLimit(tenantSlug: string, plan: string): boolean {
  const now = Date.now();
  const max = getPlanRpm(plan);
  const key = `${tenantSlug}:${plan}`;
  const existing = planRateState.get(key);

  if (!existing || now - existing.windowStart >= 60_000) {
    planRateState.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= max) {
    return false;
  }

  existing.count += 1;
  planRateState.set(key, existing);
  return true;
}

function sendError(
  reply: { status: (code: number) => { send: (payload: unknown) => unknown } },
  statusCode: number,
  message: string,
  code: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'QUOTA_EXCEEDED' | 'UPSTREAM_ERROR' | 'INTERNAL_ERROR',
  requestId?: string,
  extra?: Record<string, unknown>
) {
  return reply.status(statusCode).send({
    error: message,
    code,
    ...(requestId ? { requestId } : {}),
    ...(extra ?? {}),
  });
}

async function checkUpstreamHealth(url: string): Promise<'connected' | 'unreachable'> {
  const healthUrl = `${url.replace(/\/$/, '')}/health`;
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
    return response.ok ? 'connected' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
});

fastify.addHook('onRequest', async (request, reply) => {
  reply.header('x-request-id', request.id);
});

await fastify.register(cors, { origin: true });

await fastify.register(rateLimit, {
  max: 500,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: 'Too many requests',
    code: 'RATE_LIMITED',
  }),
});

fastify.addHook('preHandler', async (request, reply) => {
  if (request.url === '/health') {
    return;
  }

  if (env.DEV_BYPASS_AUTH) {
    const context: RequestWithTenant = {
      tenantId: env.DEV_TENANT_ID,
      tenantSlug: env.DEV_TENANT_ID,
      plan: 'enterprise',
    };
    request.headers['x-tenant-id'] = context.tenantSlug;
    (request as typeof request & RequestWithTenant).tenantId = context.tenantId;
    (request as typeof request & RequestWithTenant).tenantSlug = context.tenantSlug;
    (request as typeof request & RequestWithTenant).plan = context.plan;
    return;
  }

  // Service key — allows dashboard server-side queries to scope to any tenant
  const serviceKey = env.GATEWAY_SERVICE_KEY;
  if (serviceKey) {
    const rawKey = extractRawApiKey(request.headers.authorization);
    if (rawKey === serviceKey) {
      const tenantSlug = request.headers['x-tenant-slug'];
      if (!tenantSlug || typeof tenantSlug !== 'string') {
        return sendError(reply, 400, 'x-tenant-slug header required with service key', 'BAD_REQUEST', request.id);
      }
      // Set tenant context from the explicit header — skip DB lookup
      request.headers['x-tenant-id'] = tenantSlug;
      (request as typeof request & RequestWithTenant).tenantId = tenantSlug;
      (request as typeof request & RequestWithTenant).tenantSlug = tenantSlug;
      (request as typeof request & RequestWithTenant).plan = 'enterprise'; // service key gets highest limits
      (request as typeof request & RequestWithTenant).isServiceKey = true;
      return; // skip normal auth
    }
  }

  if (!env.USERS_DATABASE_URL) {
    return sendError(reply, 503, 'Auth database not configured', 'INTERNAL_ERROR', request.id);
  }

  const rawApiKey = extractRawApiKey(request.headers.authorization);
  if (!rawApiKey) {
    return sendError(reply, 401, 'API key required', 'UNAUTHORIZED', request.id);
  }

  const keyInfo = await lookupApiKey(rawApiKey);
  if (!keyInfo) {
    return sendError(reply, 401, 'Invalid API key', 'UNAUTHORIZED', request.id);
  }

  const withinPlanRate = checkPlanRateLimit(keyInfo.tenantSlug, keyInfo.plan);
  if (!withinPlanRate) {
    return sendError(reply, 429, 'Too many requests', 'RATE_LIMITED', request.id);
  }

  const quota = await checkQuota(keyInfo.tenantId, keyInfo.plan);
  if (!quota.allowed) {
    return sendError(reply, 429, 'Monthly quota exceeded', 'QUOTA_EXCEEDED', request.id, {
      upgrade: 'https://eidolondb.com/pricing',
    });
  }

  request.headers['x-tenant-id'] = keyInfo.tenantSlug;
  (request as typeof request & RequestWithTenant).tenantId = keyInfo.tenantId;
  (request as typeof request & RequestWithTenant).tenantSlug = keyInfo.tenantSlug;
  (request as typeof request & RequestWithTenant).plan = keyInfo.plan;
});

fastify.get('/health', async (_request, reply) => {
  const upstream = await checkUpstreamHealth(env.EIDOLONDB_INTERNAL_URL);
  reply.send({
    status: 'healthy',
    upstream,
    timestamp: new Date().toISOString(),
  });
});

// Register explicit methods instead of .all() to avoid conflict with CORS OPTIONS handler
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
  fastify.route({
    method,
    url: '/*',
    handler: async (request, reply) => proxyRequest(request, reply),
  });
}

async function proxyRequest(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
  const tenantSlug = (request as typeof request & RequestWithTenant).tenantSlug;
  const tenantId = (request as typeof request & RequestWithTenant).tenantId;
  const targetPath = request.raw.url ?? request.url;
  const targetUrl = `${env.EIDOLONDB_INTERNAL_URL}${targetPath}`;

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'content-type': request.headers['content-type'] ?? 'application/json',
        'x-tenant-id': tenantSlug,
      },
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? typeof request.body === 'string'
            ? request.body
            : JSON.stringify(request.body ?? {})
          : undefined,
    });

    if (response.status < 500 && !env.DEV_BYPASS_AUTH && !(request as typeof request & RequestWithTenant).isServiceKey) {
      Promise.resolve(incrementOps(tenantId, currentMonthKey(), 1)).catch(console.error);
    }

    const contentType = response.headers.get('content-type') ?? 'application/json';
    const bodyText = await response.text();
    reply.status(response.status).type(contentType).send(bodyText);
  } catch (error) {
    request.log.error({ err: error }, 'gateway upstream request failed');
    return sendError(reply, 502, 'Failed to reach upstream service', 'UPSTREAM_ERROR', request.id);
  }
}

fastify.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'gateway unhandled error');
  return sendError(reply, 500, 'An unexpected error occurred', 'INTERNAL_ERROR', request.id);
});

if (!env.USERS_DATABASE_URL && !env.DEV_BYPASS_AUTH) {
  fastify.log.warn(
    'USERS_DATABASE_URL is not set and DEV_BYPASS_AUTH=false; auth lookups will fail until database is configured.'
  );
}

try {
  await fastify.listen({ port: env.PORT, host: env.HOST });
  fastify.log.info(`Gateway listening on ${env.HOST}:${env.PORT}`);
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
