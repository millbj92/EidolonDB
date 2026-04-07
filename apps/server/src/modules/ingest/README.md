# Ingest Module

## Overview

The ingest module provides `POST /ingest`, an auto-extraction pipeline that converts unstructured input into candidate memories, deduplicates them, optionally persists accepted memories, and always writes a trace record to `ingest_traces`.

## Pipeline Stages

1. Normalize
- Strips null bytes
- Normalizes line breaks
- Collapses repeated blank lines
- Trims outer whitespace
- Rejects normalized payloads shorter than 10 characters

2. Extract
- Calls OpenAI Chat Completions (`gpt-4o-mini`) with JSON-only output constraints
- Validates output against `ExtractorOutput` Zod schema
- Handles extraction failures gracefully by adding warnings and continuing with no candidates
- Rejects candidates with confidence `< 0.3`

3. Dedup
- Performs lexical dedup using word-level Jaccard similarity
- Optionally performs vector dedup through existing memory query flow when embeddings are available
- Status mapping:
  - `duplicate`: rejected
  - `near_duplicate`: accepted with warning
  - `new`: accepted
  - `needs_review` / `conflict`: rejected

4. Persist
- If `autoStore=true`, accepted memories are persisted via `createMemory`
- Embeddings are generated when an embeddings provider is available

5. Trace
- Persists an `ingest_traces` record for every ingest run (including partial failures)
- Captures candidate counts, acceptance/rejection counts, warnings, errors, and duration

## Environment Variables

- `DATABASE_URL` (required)
- `OPENAI_API_KEY` (required for LLM extraction and OpenAI embeddings)
- `LOG_LEVEL` (standard server logging)

## Example Request

```bash
curl -X POST http://localhost:3000/ingest \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-id: tenant-demo' \
  -d '{
    "content": "We agreed to launch feature flags by April 30 and use Slack for rollout updates.",
    "source": "chat",
    "actorId": "pm-123",
    "sessionId": "session-456",
    "autoStore": true,
    "debug": true
  }'
```

## Known Limitations

- Dedup thresholds are heuristic and static.
- Lexical dedup only checks the most recent memory window.
- `near_duplicate` and `needs_review` handling is rule-based, not learned.
- Extraction quality depends on LLM output consistency and prompt version.
- If extraction fails (for example missing `OPENAI_API_KEY`), the pipeline returns no candidates but still records trace data.
