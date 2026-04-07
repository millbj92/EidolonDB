# Lifecycle Management

The lifecycle system automates tier promotion, decay, and distillation so memory storage stays useful over time:

- Expire stale, low-signal `short_term` memories
- Promote active `short_term` memories to `episodic`
- Distill valuable `episodic` memories into durable `semantic` facts
- Archive stale `episodic` memories
- Recompute recency decay scores across all tenant memories

## Flow

```text
short_term
  | age <= 24h ----------------------------> unchanged
  | age > 24h and accessCount == 0 -------> expired (delete)
  | age > 24h and accessCount >= 2 --------> promoted to episodic
  | age > 24h and 0 < accessCount < 2 ----> expired (delete)

episodic
  | age > 30d and accessCount <= 0 -------> archived (delete)
  | age > 7d and importance >= 0.7
  |   and accessCount >= 2 ---------------> distilled to semantic (+ relation)
  | otherwise -----------------------------> unchanged

semantic
  | always --------------------------------> unchanged
```

## Default Rules

`DEFAULT_LIFECYCLE_RULES`:

- `shortTerm.expireAfterMs`: `24 * 60 * 60 * 1000`
- `shortTerm.promoteIfAccessCount`: `2`
- `shortTerm.expireIfUnaccessed`: `true`
- `episodic.distillAfterMs`: `7 * 24 * 60 * 60 * 1000`
- `episodic.distillIfImportance`: `0.7`
- `episodic.distillIfAccessCount`: `2`
- `episodic.archiveAfterMs`: `30 * 24 * 60 * 60 * 1000`
- `episodic.archiveIfAccessCount`: `0`

You can override defaults when calling `runLifecycle(tenantId, { rules })`.

## API

### `POST /lifecycle/run`

Runs lifecycle processing for the tenant in `x-tenant-id`.

Request body:

```json
{
  "dryRun": false,
  "triggeredBy": "manual"
}
```

- `dryRun=true` computes actions without mutating memories.
- A `lifecycle_runs` record is always persisted, including dry runs.

### `GET /lifecycle/runs`

Returns recent lifecycle runs for the current tenant.

Query params:

- `limit` (optional): default `20`, max `100`

## Manual Trigger (curl)

```bash
curl -X POST http://localhost:3000/lifecycle/run \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: tenant-1' \
  -d '{"dryRun":false,"triggeredBy":"manual"}'
```

## Known Limitations / Next Steps

- Cron scheduling is not included yet (manual/API trigger only).
- Per-tenant lifecycle rule persistence is not implemented yet.
- Distillation conflict resolution is not implemented; it currently writes a semantic memory and `DISTILLED_FROM` relation directly.
