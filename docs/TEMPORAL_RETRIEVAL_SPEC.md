# Temporal Retrieval — Feature Spec

**Status:** Planned (Phase 4)  
**Author:** Leon / Brandon  
**Date:** 2026-04-09

---

## Problem

EidolonDB currently retrieves memories via semantic vector search only. This works well for fact-based queries ("what port did we use?") but fails for temporal queries:

- "What did we do last session?" → retrieves semantically similar content, not recent content
- "What did we do yesterday?" → same failure
- "What changed last week?" → no meaningful result

The data to answer these queries already exists (`createdAt` timestamps, `sessionNumber` metadata). The gap is in the retrieval layer.

---

## Two Distinct Retrieval Modes

These are meaningfully different and must be handled separately.

### Mode 1: Session-Relative Queries

**Triggers:** "last session", "last time we talked", "previous session", "last time", "our last conversation", "N sessions ago"

**Retrieval strategy:**
- Use `sessionNumber` metadata, not wall-clock time
- Sessions don't map cleanly to calendar days, so timestamps are unreliable for this mode
- `"last session"` → `sessionNumber = max(sessionNumber) - 1`
- `"2 sessions ago"` → `sessionNumber = max(sessionNumber) - 2`
- Filter memories by `sessionNumber`, then rank by semantic similarity within that set

**Why `sessionNumber` over timestamp:**
- Sessions may happen multiple times in one day, or span days
- Users think in sessions ("last time we talked"), not wall-clock time
- More reliable and deterministic

---

### Mode 2: Calendar-Relative Queries

**Triggers:** "yesterday", "last week", "on Thursday", "last Monday", "this week", "last month", "3 days ago", "on April 7th"

**Retrieval strategy:**
- Parse temporal expression → resolve to a UTC date window `[start, end)`
- Prefilter: `WHERE createdAt >= start AND createdAt < end`
- Run semantic vector search within the filtered result set
- If filtered set is empty → return "I don't see any activity from that period. The most recent activity was [X]."

**Temporal expression parsing (examples):**
| Expression | Resolved window |
|---|---|
| "yesterday" | `[now - 1d 00:00, now - 1d 23:59]` in user's timezone |
| "last week" | `[last Monday 00:00, last Sunday 23:59]` |
| "last Thursday" | `[last Thu 00:00, last Thu 23:59]` |
| "3 days ago" | `[now - 3d 00:00, now - 3d 23:59]` |
| "this week" | `[this Monday 00:00, now]` |
| "last month" | `[1st of last month, last day of last month]` |

**Timezone handling:**
- Default to UTC if user timezone not set
- User timezone should be configurable per-tenant (store in tenant config)
- Pass current timestamp to resolver so "yesterday" resolves correctly

---

## Intent Detection

Before retrieval, classify the query to select the mode.

**Implementation:** regex pattern matching over the user message — no LLM call needed.

```
Session-relative patterns:
  /last session/i
  /previous session/i  
  /last time (we|I|you)/i
  /\d+ sessions? ago/i
  /our last conversation/i

Calendar-relative patterns:
  /yesterday/i
  /last (week|month|monday|tuesday|wednesday|thursday|friday)/i
  /this (week|month)/i
  /\d+ days? ago/i
  /on (monday|tuesday|...|april \d+|[a-z]+ \d+)/i
  /recently/i  → recency-weighted scoring (see below)
```

If **neither** pattern matches → default semantic search (current behavior, no change).

If **both** match (e.g. "what did we do last Thursday in our last session?") → run both, merge results, deduplicate.

---

## Edge Case: "Recently"

"Recently" is ambiguous — not a specific time, not a session reference. Handle with **recency-weighted scoring** as a secondary signal on top of semantic search:

```
final_score = semantic_score * 0.7 + recency_score * 0.3

recency_score = e^(-λ * age_in_hours)   where λ = 0.05 (half-life ~14h)
```

This is the only place recency weighting is applied — not as a global default.

---

## Graceful Degradation

When temporal filters return no results, the agent must not hallucinate:

> "I don't see any activity from [time period]. The most recent memories I have are from [date/session]."

This reinforces trust and is consistent with EidolonDB's existing false-premise rejection behavior.

---

## API Changes

### Option A: Query-time parameter (preferred)
Extend `POST /memories/query` to accept optional temporal hints:

```json
{
  "text": "what did we work on",
  "k": 5,
  "temporal": {
    "mode": "session-relative",
    "sessionOffset": -1
  }
}
```

```json
{
  "text": "what did we work on",
  "k": 5,
  "temporal": {
    "mode": "calendar-relative",
    "start": "2026-04-07T00:00:00Z",
    "end": "2026-04-07T23:59:59Z"
  }
}
```

### Option B: Client-side intent detection
The agent (EidolonDB eval agent, SDK, etc.) detects intent and adds the `temporal` parameter before calling the API. This keeps the API simple and puts detection in the client layer.

**Recommendation:** Option B first (faster, no API schema change), promote to Option A in a follow-up.

---

## Eval Coverage

New scenarios needed for the eval suite:

### `temporal-session-v1`
- Session 1: Establish facts (stack, decisions)
- Session 2: Establish different facts
- Session 3: Ask "what did we do last session?" → should recall Session 2 facts, not Session 1

### `temporal-calendar-v1`
- Requires mocked `createdAt` timestamps during eval setup
- Seed memories with known dates
- Ask "what did we do yesterday?" → should surface yesterday's memories

**Scoring note:** Temporal recall answers are prose-heavy — keyword matching is insufficient. These scenarios require an **LLM judge** to score answers rather than `scoreRecall`. This is a prerequisite before shipping eval coverage for Mode 2.

---

## Implementation Plan

### Phase 4a — Session-Relative (P1, ~2 days)
1. Add `sessionNumber` to memory metadata on ingest (already partially there)
2. Add `temporal.mode = "session-relative"` filter to `POST /memories/query` — accepts absolute `sessionNumber`, not offset (offset is computed client-side)
3. Add intent detection regex to EidolonDB agent (`agents.ts` in eval, and SDK clients)
4. Add graceful degradation response when no results found
5. Add `temporal-session-v1` eval scenario
6. **Update JS + Python SDKs** — expose `sessionNumber` param on `recall()` so callers can pass current session context. Caller always knows their session number (they ingest with it). Pattern: `client.recall(query, { sessionNumber: 2 })`

### Phase 4b — Calendar-Relative (P2, ~3 days)
1. Add temporal expression parser (date window resolver)
2. Add `temporal.mode = "calendar-relative"` filter to `POST /memories/query` with `[start, end)` range
3. Add timezone config to tenant settings
4. Add intent detection for calendar patterns
5. Add LLM judge scorer to eval suite
6. Add `temporal-calendar-v1` eval scenario (with mocked timestamps)

### Phase 4c — "Recently" / Recency Weighting (P3, ~1 day)
1. Add recency-weighted scoring mode to query endpoint
2. Wire up for "recently" trigger

---

## What This Unlocks

After Phase 4a+4b, EidolonDB has:
- ✅ Semantic memory (current)
- ✅ Truth/hallucination validation (current)
- ✅ Session-relative temporal reasoning (4a)
- ✅ Calendar-relative temporal reasoning (4b)

That combination — semantic + truth-grounded + time-aware — is genuinely rare in production memory systems.
