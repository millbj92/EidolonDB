# EidolonDB Eval - Known Limitations & Edge Cases

This document describes scenarios where EidolonDB's performance is limited or where the eval suite has known gaps.

## 1. Ambiguous / Implicit Information

EidolonDB's LLM extraction pipeline uses gpt-4o-mini to extract facts from session transcripts. When information is stated ambiguously (e.g., "mid-morning" instead of "10 AM"), the extractor may:
- Store the literal phrasing rather than the implied fact
- Miss the implication entirely

**Eval coverage:** `ambiguous-recall-v1` scenario tests this directly. Expected: partial credit (0.5-0.8 range), not perfect recall.

## 2. Preference Drift & Contradiction Resolution

When a user updates a fact (e.g., changes port from 8080 to 3000), EidolonDB stores both facts. The retrieval system returns whichever is most semantically similar to the query - it does NOT guarantee the most recent fact wins.

**Current behavior:** The LLM is instructed to prefer "latest in-session statement", but if two conflicting memories are retrieved from past sessions, there's no automatic conflict resolution.

**Eval coverage:** `contradictory-memory-v1` scenario. Expected: good on updates within a session, degraded on cross-session contradictions.

**Planned:** Conflict resolution module (Phase 4 roadmap).

## 3. Information Density Limits

EidolonDB's ingest pipeline uses gpt-4o-mini with a single extraction call per session transcript. For dense sessions (5+ distinct facts), the extractor may:
- Miss low-salience facts (team member names, specific SLAs)
- Merge related facts incorrectly
- Hit token limits on very long sessions

**Eval coverage:** `incomplete-recall-v1` scenario. Expected: 60-85% recall on dense fact sets.

## 4. Baseline Comparison Caveats

The eval includes two baselines:
- **No-memory baseline:** A plain LLM with no memory whatsoever. This is the "worst case" floor.
- **RAG baseline:** A simple bag-of-words TF-IDF retrieval over raw session transcripts. No LLM extraction, no dedup, no tier promotion.

EidolonDB is compared against both. The RAG baseline represents what most naive "chat with memory" implementations do - it's a more honest comparison than pure no-memory.

Both EidolonDB and the RAG baseline now use the same false-premise rejection prompt logic (cross-check past-recall claims, reject absent claims, accept new information and in-session updates). The comparison difference is retrieval mechanism quality: TF-IDF keyword matching over raw transcripts (RAG baseline) versus EidolonDB's LLM-extracted memory vector store.

## 5. Hallucination Scoring Limitation

The hallucination scorer checks for exact keyword presence ("no record", "not discussed", etc.). An agent that handles hallucinations gracefully but uses different phrasing (e.g., "I can't confirm that") may be scored incorrectly.

**Planned:** Semantic hallucination scoring via LLM judge.

## 6. Eval Determinism

All LLM calls use `temperature: 0` for reproducibility, but:
- OpenAI model updates can change behavior
- The eval is not hermetic - it calls live APIs (OpenAI, EidolonDB)

Run scores may vary slightly across model versions.
