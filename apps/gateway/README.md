# EidolonDB Gateway

`apps/gateway` is the public auth proxy for EidolonDB Cloud. It sits between internet clients and the internal EidolonDB API server.

It is responsible for:
- Verifying `Authorization: Bearer <api_key>` against the billing database.
- Resolving the API key to a tenant.
- Injecting `x-tenant-id` before forwarding traffic to the internal server.
- Enforcing rate limits and plan quotas.
- Tracking monthly usage counters.

## Environment Variables

- `PORT` (default: `3001`): Gateway listen port.
- `HOST` (default: `0.0.0.0`): Gateway bind host.
- `LOG_LEVEL` (default: `info`): Fastify log level.
- `DATABASE_URL`: Neon Postgres URL for users/billing data.
- `EIDOLONDB_INTERNAL_URL` (default: `http://localhost:3000`): Internal EidolonDB upstream URL.
- `DEV_BYPASS_AUTH` (default: `false`): Skip API key auth in local development.
- `DEV_TENANT_ID` (default: `openclaw`): Tenant slug injected when bypassing auth.

If `DATABASE_URL` is not set and `DEV_BYPASS_AUTH=false`, the process still starts but authenticated requests will fail.

## Local Development

1. Copy env template:

```bash
cp apps/gateway/.env.example apps/gateway/.env
```

2. For local-only testing without billing DB, set:

```bash
DEV_BYPASS_AUTH=true
DEV_TENANT_ID=openclaw
```

3. Start the service:

```bash
corepack pnpm --filter @eidolondb/gateway dev
```

## Auth Flow

1. Client sends `Authorization: Bearer <api_key>`.
2. Gateway extracts first 16 chars (`key_prefix`) and checks in-memory LRU cache first.
3. On cache miss, gateway loads candidate keys from `api_keys` by prefix and checks bcrypt hash.
4. On match, gateway resolves tenant + plan and sets `x-tenant-id: <tenantSlug>` for upstream requests.
5. Gateway updates `last_used_at` in the background.

No plaintext API keys are stored.

## Rate Limiting and Quotas

Two layers are enforced:

1. Coarse global per-IP limiter via `@fastify/rate-limit` (`500 req/min`) to absorb abuse before auth.
2. Per-tenant per-plan limiter in memory using plan RPM thresholds:
- free: 100 RPM
- pro: 1,000 RPM
- team: 2,000 RPM
- enterprise: 10,000 RPM

Monthly quotas are checked from usage counters:
- free: 10,000 memories/month, 1,000 queries/month
- pro: 500,000 memories/month, 100,000 queries/month
- team: unlimited memories, 1,000,000 queries/month
- enterprise: unlimited memories and queries

Usage counters are incremented asynchronously after proxying classified requests (`memory_write`, `query`, `ingest`, `lifecycle`).

## Health Endpoint

- `GET /health`

Returns:

```json
{
  "status": "healthy",
  "upstream": "connected",
  "timestamp": "2026-04-07T00:00:00.000Z"
}
```

The endpoint pings `<EIDOLONDB_INTERNAL_URL>/health` with a 2 second timeout.

## Railway Deployment

1. Create a Railway service rooted at `apps/gateway`.
2. Set all env vars from `.env.example`.
3. Ensure private networking to the internal EidolonDB server URL.
4. Set start command:

```bash
corepack pnpm --filter @eidolondb/gateway start
```

5. Keep the internal EidolonDB server non-public; only the gateway should be internet-facing.
