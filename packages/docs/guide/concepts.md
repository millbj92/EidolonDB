# Concepts

## What Is EidolonDB?

EidolonDB is a memory system for AI agents. Instead of only storing embeddings, it extracts candidate memories, classifies them into tiers, deduplicates low-signal data, and runs lifecycle policies to evolve memory over time.

## How It Differs from a Vector DB

A vector DB is primarily storage + similarity lookup. EidolonDB adds memory behavior:

- extraction from raw unstructured input
- tiered memory state (`short_term`, `episodic`, `semantic`)
- lifecycle automation (promotion, distillation, expiration, archival)
- hybrid ranking (semantic + recency + importance)

## The Three Tiers

- `short_term`: immediate, volatile context; decays quickly
- `episodic`: medium-horizon events and decisions
- `semantic`: durable long-term facts and distilled knowledge

## Memory Pipeline

1. Ingest raw input (`POST /ingest`)
2. Extract candidate memories with LLM
3. Classify candidates by memory tier
4. Deduplicate against existing memory
5. Store accepted memory (if `autoStore: true`)
6. Apply lifecycle rules over time (`POST /lifecycle/run`)
