# Retrieval Feedback Loop

The retrieval feedback loop captures which memories are surfaced by retrieval, records whether they were actually used, and aggregates those signals for ranking and lifecycle decisions.

## Why it matters

- `accessCount` only captures explicit access events.
- Retrieval ranking quality also depends on what was shown and what was useful.
- `retrieval_events` provides structured signal for downstream tuning and retention policies.

## Data model

### `retrieval_events`

Each retrieval result can produce one event:

- `tenantId`
- `memoryId`
- `queryText`
- `retrievalScore` (0-1)
- `wasUsed` (default `false`)
- `relevanceFeedback` (optional 0-1)
- `sessionId`
- `actorId`
- `metadata`
- `createdAt`

### `memories` additions

- `retrievalCount`: total number of times surfaced in retrieval results
- `lastRetrievedAt`: timestamp of the most recent retrieval surfacing

## API

### `POST /feedback/mark-used`

Mark memories as used after a retrieval call.

Request body:

```json
{
  "memoryIds": ["uuid"],
  "sessionId": "optional",
  "actorId": "optional",
  "relevanceFeedback": {
    "memory-uuid": 0.9
  }
}
```

Behavior:

- Updates recent (`< 1 hour`) `retrieval_events` with `wasUsed=true`
- Applies optional `relevanceFeedback` per memory
- Bumps memory `accessCount` via existing memory-access path

Response:

```json
{
  "updated": 2,
  "memoryIds": ["uuid"]
}
```

### `GET /feedback/stats/:memoryId`

Returns aggregated retrieval stats for one memory.

### `GET /feedback/stats?limit=20&sortBy=retrievalCount`

Returns aggregated retrieval stats for multiple memories.

- `sortBy`: `retrievalCount | usageCount | lastRetrievedAt`

## Lifecycle integration

Episodic distillation now considers retrieval surfacing signal:

- Previous: `age > 7d AND importance >= 0.7 AND accessCount >= 2`
- Current: `age > 7d AND importance >= 0.7 AND (accessCount >= 2 OR retrievalCount >= 3)`

This treats retrieval presence as weaker-but-meaningful utility evidence.

## Known gaps

- Retrieval feedback does not yet auto-promote memory `importanceScore`.
- No automated ranker learning loop yet (stats are collected and queryable first).
