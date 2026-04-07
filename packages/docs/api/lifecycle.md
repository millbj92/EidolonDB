# Lifecycle API

Lifecycle runs manage promotion, distillation, expiration, and archival.

## Default Rules

- short-term expiry: `24h`
- episodic distillation threshold: `7d`
- episodic archival threshold: `30d`

## `POST /lifecycle/run`

Trigger a lifecycle run.

Request body:

```json
{
  "dryRun": true,
  "triggeredBy": "manual"
}
```

Response (no `{ data: ... }` wrapper):

```json
{
  "success": true,
  "runId": "uuid",
  "dryRun": true,
  "summary": {
    "expired": 3,
    "promoted": 2,
    "distilled": 1,
    "archived": 1,
    "unchanged": 10,
    "durationMs": 492
  },
  "details": [
    {
      "memoryId": "uuid",
      "action": "promoted",
      "fromTier": "short_term",
      "toTier": "episodic",
      "reason": "access_count threshold met"
    }
  ],
  "errors": []
}
```

Use `dryRun: true` to inspect actions without mutating data.

Curl:

```bash
curl -X POST http://localhost:3000/lifecycle/run \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{"dryRun":true,"triggeredBy":"manual"}'
```

## `GET /lifecycle/runs`

List recent lifecycle runs.

Query params:

- `limit` (default `20`, max `100`)

Response:

```json
{
  "runs": [
    {
      "id": "uuid",
      "tenantId": "my-app",
      "triggeredBy": "manual",
      "durationMs": 492,
      "expired": 3,
      "promoted": 2,
      "distilled": 1,
      "archived": 1,
      "unchanged": 10,
      "errors": [],
      "completedAt": "2026-04-07T10:00:00.000Z",
      "createdAt": "2026-04-07T09:59:59.000Z"
    }
  ]
}
```

Curl:

```bash
curl 'http://localhost:3000/lifecycle/runs?limit=10' \
  -H 'x-tenant-id: my-app'
```
