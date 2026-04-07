# Ingest API

## `POST /ingest`

Run the full ingest pipeline: extraction, classification, dedup, and optional auto-store.

Headers:

- `x-tenant-id: <tenant>`
- `content-type: application/json`

Request body fields:

- `content` (string, 1..50000)
- `source` (`chat|note|event|document|system`)
- `actorId` (optional string)
- `sessionId` (optional string)
- `ownerEntityId` (optional UUID)
- `autoStore` (optional boolean, default `true`)
- `debug` (optional boolean, default `false`)
- `metadata` (optional object)

Example request:

```json
{
  "content": "Today we decided to use Fastify for the API. Port is 4000.",
  "source": "chat",
  "actorId": "agent-01",
  "sessionId": "sess-01",
  "autoStore": true,
  "debug": true,
  "metadata": { "room": "eng-sync" }
}
```

Response shape:

```json
{
  "data": {
    "success": true,
    "traceId": "uuid",
    "summary": {
      "candidates": 3,
      "accepted": 2,
      "rejected": 1
    },
    "acceptedMemories": [
      {
        "content": "We use Fastify for the API",
        "memoryType": "semantic",
        "importance": 0.84,
        "confidence": 0.91,
        "tags": ["decision"],
        "sourceSpan": "...",
        "rationale": "...",
        "memoryId": "uuid",
        "dedupStatus": "new"
      }
    ],
    "rejectedMemories": [
      {
        "content": "...",
        "memoryType": "short_term",
        "importance": 0.2,
        "confidence": 0.3,
        "tags": [],
        "sourceSpan": "...",
        "rationale": "...",
        "dedupStatus": "duplicate",
        "reason": "Near-duplicate of existing memory"
      }
    ],
    "warnings": [],
    "debug": {
      "normalizedInput": "...",
      "extractorVersion": "...",
      "promptVersion": "...",
      "durationMs": 1420
    }
  }
}
```

## Pipeline Stages (A-E)

- A. Normalize input and validate request
- B. Extract candidate memories from raw text
- C. Classify memories (`short_term|episodic|semantic`) with importance/confidence
- D. Deduplicate (`new|duplicate|near_duplicate|conflict|needs_review`)
- E. Store accepted memory when `autoStore` is enabled

## Curl

```bash
curl -X POST http://localhost:3000/ingest \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{
    "content":"Today we decided to use Fastify for the API. Port is 4000.",
    "source":"chat",
    "debug":true
  }'
```
