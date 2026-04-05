# EidolonDB Architecture

## Overview

EidolonDB is a unified memory layer for AI agents, combining vector, symbolic, graph, and temporal access patterns into a single coherent system.

## Core Concepts

### Entities

Logical nodes representing objects in the world: users, agents, projects, documents, etc.

- Multi-tenant via `tenant_id`
- Flexible `properties` JSONB field for custom attributes
- Can reference a primary artifact for detailed content

### Artifacts

Raw content storage for text, code, documents, etc.

- Stores full content in `content` field
- Classified by `kind` (text, code, pdf, html)
- Can be chunked into Memories for retrieval

### Memories

The primary retrieval unit for LLM context building.

- Organized into tiers: `short_term`, `episodic`, `semantic`
- Scored by `importance_score`, `recency_score`
- Tracks `access_count` for popularity-based ranking
- Links to source Artifacts and Embeddings

### Embeddings

Vector representations for semantic search.

- Stored using pgvector extension
- Polymorphic: can belong to Memory, Artifact, or Entity
- Indexed for fast similarity search

### Relations

Graph edges connecting entities, artifacts, and memories.

- Typed edges (AUTHORED, MENTIONS, RELATED_TO, etc.)
- Optional weight for edge strength
- Flexible properties for edge metadata

### Events

Action logs for episodic memory and traces.

- Links to actor Entity
- Timestamped for temporal queries
- JSONB payload for flexible event data

## Database Schema

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Entities  │────▶│  Artifacts  │◀────│   Memories  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Relations  │     │  Embeddings │     │   Events    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Tech Stack

- **Runtime**: Node.js (LTS)
- **Framework**: Fastify
- **Database**: PostgreSQL + pgvector
- **ORM**: Drizzle
- **Validation**: Zod

## API Design

### Stage 1 - Foundation

- `GET /health` - Health check with DB connectivity
- `POST /entities` - Create entity
- `GET /entities/:id` - Get entity by ID

### Stage 2 - Ingestion Pipeline

- `POST /artifacts` - Create artifact with optional auto-processing
  - Text chunking into memories (character-based with sentence boundary awareness)
  - Embedding generation via OpenAI text-embedding-3-small
- `GET /artifacts/:id` - Get artifact by ID

### Stage 3 - Memory Query

- `POST /memories/query` - Hybrid query combining:
  - Vector similarity search (cosine distance via pgvector)
  - Symbolic filters (tier, tags, owner, time range)
  - Multi-signal scoring (semantic + recency + importance)
- `GET /memories/:id` - Get memory by ID

### Stage 4 - Context Builder

- `POST /context/build` - Build LLM-ready context
  - Queries memories from multiple tiers
  - Merges and re-ranks results
  - Builds messages array with system prompts, user profiles, and memories
  - Estimates tokens and trims to fit budget
  - Returns OpenAI-compatible message format

## Scoring Algorithm

Memory query results are scored using a weighted combination:

```
final_score = w_semantic * semantic_score + w_recency * recency_score + w_importance * importance_score
```

Where:
- **semantic_score**: Cosine similarity from vector search (0-1)
- **recency_score**: Exponential decay based on age, `exp(-age_days / 7)` (0-1)
- **importance_score**: Stored importance value (0-1)

Default weights: semantic=0.7, recency=0.2, importance=0.1
