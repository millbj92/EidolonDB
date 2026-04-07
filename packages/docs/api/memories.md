# Memories API

All requests require `x-tenant-id`.

```http
x-tenant-id: my-app
content-type: application/json
```

> Note: the SDK exposes full CRUD for memories. In this monorepo snapshot, `GET/PATCH/DELETE/query/access/stats` are present in server routes; `POST /memories` is part of the SDK contract.

## `POST /memories` - Create Memory

Request body:

```json
{
  "ownerEntityId": "optional-uuid",
  "tier": "semantic",
  "content": "User prefers concise responses",
  "sourceArtifactId": "optional-uuid",
  "sourceEventId": "optional-uuid",
  "importanceScore": 0.9,
  "metadata": { "channel": "chat" },
  "tags": ["preference"]
}
```

Response shape (SDK): `Memory`

Curl:

```bash
curl -X POST http://localhost:3000/memories \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{"tier":"semantic","content":"User prefers concise responses"}'
```

## `GET /memories` - List Memories

Query params:

- `offset` (default `0`)
- `limit` (default `20`, max `100`)
- `tier` (`short_term|episodic|semantic`)
- `tag`
- `ownerEntityId`
- `sortBy` (`createdAt|importanceScore|accessCount`)
- `sortOrder` (`asc|desc`)

Response:

```json
{
  "data": {
    "memories": [
      {
        "id": "uuid",
        "tenantId": "my-app",
        "ownerEntityId": null,
        "tier": "semantic",
        "content": "...",
        "sourceArtifactId": null,
        "sourceEventId": null,
        "embeddingId": "uuid-or-null",
        "importanceScore": 0.9,
        "recencyScore": 0.85,
        "accessCount": 4,
        "lastAccessedAt": "2026-04-07T10:00:00.000Z",
        "metadata": {},
        "tags": ["preference"],
        "createdAt": "2026-04-01T10:00:00.000Z",
        "updatedAt": "2026-04-01T10:00:00.000Z"
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  }
}
```

Curl:

```bash
curl 'http://localhost:3000/memories?tier=semantic&limit=10' \
  -H 'x-tenant-id: my-app'
```

## `GET /memories/:id` - Get Memory by ID

Response: `{ data: Memory }`

Curl:

```bash
curl http://localhost:3000/memories/<memory-id> \
  -H 'x-tenant-id: my-app'
```

## `PATCH /memories/:id` - Update Memory

Request body (at least one field required):

```json
{
  "content": "Updated memory text",
  "tier": "episodic",
  "importanceScore": 0.8,
  "tags": ["updated"],
  "metadata": { "editedBy": "system" }
}
```

Response: `{ data: Memory }`

Curl:

```bash
curl -X PATCH http://localhost:3000/memories/<memory-id> \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{"importanceScore":0.95}'
```

## `DELETE /memories/:id` - Delete Memory

Response:

```json
{ "data": { "deleted": true } }
```

Curl:

```bash
curl -X DELETE http://localhost:3000/memories/<memory-id> \
  -H 'x-tenant-id: my-app'
```

## `POST /memories/query` - Hybrid Search

Request body:

```json
{
  "text": "project architecture",
  "k": 10,
  "ownerEntityId": "optional-uuid",
  "tiers": ["semantic", "episodic"],
  "tags": ["decision"],
  "sourceArtifactId": "optional-uuid",
  "createdAfter": "2026-04-01T00:00:00.000Z",
  "createdBefore": "2026-04-30T23:59:59.999Z",
  "weights": {
    "semantic": 0.7,
    "recency": 0.2,
    "importance": 0.1
  },
  "minScore": 0.2
}
```

Response:

```json
{
  "data": {
    "results": [
      {
        "memory": { "id": "uuid", "content": "...", "tier": "semantic" },
        "score": 0.92,
        "reasons": {
          "semantic": 0.88,
          "recency": 0.75,
          "importance": 0.99
        }
      }
    ],
    "query": { "text": "project architecture", "k": 10 }
  }
}
```

Curl:

```bash
curl -X POST http://localhost:3000/memories/query \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{"text":"project architecture","k":5,"tiers":["semantic"]}'
```

## `POST /memories/:id/access` - Record Access

Response: `{ data: Memory }` with incremented `accessCount` and updated `lastAccessedAt`.

Curl:

```bash
curl -X POST http://localhost:3000/memories/<memory-id>/access \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{}'
```

## `GET /memories/stats` - Memory Stats

Response:

```json
{
  "data": {
    "total": 42,
    "byTier": {
      "short_term": 10,
      "episodic": 12,
      "semantic": 20
    },
    "byDay": [{ "date": "2026-04-07", "count": 5 }]
  }
}
```

Curl:

```bash
curl http://localhost:3000/memories/stats \
  -H 'x-tenant-id: my-app'
```
