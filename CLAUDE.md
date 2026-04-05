# CLAUDE.md – EidolonDB

You are the primary coding assistant for **EidolonDB**.

EidolonDB is an **AI-native memory database** and context engine designed to act as the *persistent memory substrate* for LLM-based agents and future proto-AGI systems.

Your job is to help build, refactor, and extend the EidolonDB codebase with high-quality, production-ready code.

---

## 1. High-Level Vision

**What EidolonDB is:**

- A unified **memory layer** for AI:
  - Stores **entities**, **artifacts**, **memories**, **embeddings**, **relations**, and **events**.
  - Provides **semantic, symbolic, graph, and temporal** access to information.
  - Builds **LLM-ready context** via a `/context/build` endpoint.

**Core idea:**
> EidolonDB is the “hippocampus” and “semantic memory” for AI agents — a system that remembers, organizes, and retrieves knowledge so agents can behave consistently over long horizons.

We are not reinventing Postgres; we’re orchestrating a **specialized data model + query engine** on top of it.

---

## 2. Tech Stack & Constraints

Use the following stack unless explicitly changed:

- **Language:** TypeScript
- **Runtime:** Node.js (LTS)
- **HTTP Framework:** Fastify
- **Database:** Postgres + `pgvector` extension
- **ORM / Schema / Migrations:** Drizzle ORM
- **Package Manager:** pnpm (preferred) or npm (if already chosen)
- **Deployment Model:** Docker & docker-compose for local dev; keep infra cloud-agnostic

Non-goals for now:

- No frontend UI (we may add a dashboard later).
- No complex auth/OAuth flows; simple API key + tenant is fine initially.
- No premature microservices – **one backend app** is fine.

---

## 3. Repository Structure

Assume and maintain a structure like:

```text
ai-memory-db/
  apps/
    server/
      src/
        modules/
          health/
          entities/
          artifacts/
          memories/
          embeddings/
          relations/
          events/
          context/
        common/
          db/
          config/
          types/
        index.ts
      package.json
  infra/
    docker-compose.yml
    migrations/
  docs/
    README.md
    ARCHITECTURE.md
  package.json
  tsconfig.json
  CLAUDE.md
```

You may refine this structure, but keep it:

* **Modular:** per-domain modules (entities, memories, etc.)
* **Clear:** no god files; separate routing, handlers, services, and data access layers.
* **Extensible:** easy to add new modules (e.g., `self`, `planner`, etc. in the future).

---

## 4. Core Domain Model

Implement and maintain the following core concepts as first-class citizens:

### 4.1 Entities

Logical nodes of the world: users, agents, projects, documents, NPCs, organizations, etc.

Key fields (Postgres via Drizzle):

* `id` (string/UUID)
* `tenant_id` (string)
* `type` (string; e.g. 'user', 'agent', 'project')
* `name` (string)
* `properties` (JSONB)
* `primary_artifact_id` (nullable FK → artifacts.id)
* `tags` (text[])
* `created_at`, `updated_at`

### 4.2 Artifacts

Raw content: text, code, PDF pages, HTML, etc.

Fields:

* `id`
* `tenant_id`
* `kind` (string; e.g. 'text', 'code', 'pdf', 'html')
* `mime_type` (string)
* `content` (TEXT for now)
* `metadata` (JSONB)
* `tags`
* `created_at`, `updated_at`

Artifacts may later be chunked into Memories.

### 4.3 Memories

The **primary retrieval unit** for LLM context.

Fields:

* `id`
* `tenant_id`
* `owner_entity_id` (FK → entities.id)
* `tier` (ENUM: `'short_term' | 'episodic' | 'semantic'`)
* `content` (TEXT)
* `source_artifact_id` (nullable FK → artifacts.id)
* `source_event_id` (nullable FK → events.id)
* `embedding_id` (nullable FK → embeddings.id)
* `importance_score` (float, 0–1)
* `recency_score` (float, 0–1)
* `access_count` (int)
* `last_accessed_at` (nullable timestamp)
* `metadata` (JSONB)
* `tags`
* `created_at`, `updated_at`

### 4.4 Embeddings

Vector representations for memories, artifacts, or entities.

Fields:

* `id`
* `tenant_id`
* `owner_type` (ENUM: 'memory' | 'artifact' | 'entity')
* `owner_id`
* `model` (string)
* `dim` (int)
* `vector` (pgvector type)
* `tags`
* `created_at`, `updated_at`

Make sure to:

* Enable `pgvector` extension in migrations.
* Create appropriate vector indexes (e.g., IVF/HNSW) for similarity search.

### 4.5 Relations

Graph edges between entities, artifacts, and memories.

Fields:

* `id`
* `tenant_id`
* `type` (e.g., 'AUTHORED', 'MENTIONS', 'RELATED_TO')
* `from_type` (ENUM: 'entity' | 'artifact' | 'memory')
* `from_id`
* `to_type`
* `to_id`
* `weight` (float, nullable)
* `properties` (JSONB)
* `tags`
* `created_at`, `updated_at`

### 4.6 Events

Logs of actions taken by agents or users (useful for episodic memory and traces).

Fields:

* `id`
* `tenant_id`
* `actor_entity_id` (FK → entities.id)
* `event_type` (string)
* `timestamp`
* `payload` (JSONB)
* `tags`

---

## 5. API Design (Initial Focus)

We will build the API in stages. Respect this ordering.

### Stage 1 – Foundation

Implement:

* `GET /health`
* Basic tenant handling (e.g., `x-tenant-id` header or API key)
* Minimal CRUD for:

  * `POST /entities`
  * `GET /entities/:id`

Goal: verify full stack end-to-end (Fastify → Drizzle → Postgres).

### Stage 2 – Ingestion Pipeline

Implement:

* `POST /artifacts`

  * Creates `artifacts` row.
  * If `auto_process` is provided, chunk the artifact into memories and create embeddings for each chunk.
* Text chunker (simple character- or token-based strategy).
* `EmbeddingsProvider` abstraction:

  * `OpenAIEmbeddingsProvider` implementation.
  * `embedText(text: string): number[]`.

Return from `/artifacts`:

* created `artifact`
* list of created `memories` and `embeddings`.

### Stage 3 – Memory Query

Implement:

* `POST /memories/query`

Request: a **HybridQuery** (simplified as needed), including:

* vector query (`text`, `model`, `k`)
* symbolic filters (fields / metadata)
* time-range
* optional tier filters
* scoring weights (semantic relevance vs recency vs importance)

Behavior:

* Embed the query text.
* Run vector similarity search via pgvector.
* Apply filters.
* Combine signals into a final score.
* Return ranked results:

```jsonc
{
  "results": [
    {
      "memory": { /* Memory object */ },
      "score": 0.93,
      "reasons": {
        "semantic": 0.8,
        "recency": 0.1,
        "importance": 0.03
      }
    }
  ]
}
```

### Stage 4 – Context Builder

Implement:

* `POST /context/build`

Input:

* `agent_entity_id`
* `user_entity_id`
* `goal`
* `current_input`
* `max_tokens`
* strategy options:

  * tiers to query
  * per-tier caps
  * scoring weights
  * optional topics or metadata filters

Behavior:

* Run multiple `memories` queries (e.g., per tier/topic).
* Merge + re-rank results.
* Estimate tokens and trim to `max_tokens`.
* Build an array of **LLM-ready messages**, for example:

```jsonc
{
  "messages": [
    { "role": "system", "content": "You are a support agent..." },
    { "role": "system", "content": "User profile summary: ..." },
    { "role": "system", "content": "Relevant past interactions: ..." }
  ],
  "raw_memories": [ ... ],
  "metadata": { "total_tokens_estimated": 1820 }
}
```

---

## 6. Coding Style & Quality

* Use **strict TypeScript**.
* Prefer **small, composable modules** over large files.
* Keep a clear separation between:

  * route definitions
  * request validation
  * service/business logic
  * data access/repositories
* Use **Zod** (or similar) for runtime validation of request/response types.
* Write code that is:

  * predictable
  * testable
  * documented via comments where non-obvious.

Whenever you introduce important logic (e.g., scoring, chunking), add a short docstring or comment explaining the rationale.

---

## 7. Dev Experience

Make it easy to:

* Run the project locally with:

  * `docker compose up` (starts Postgres + server)
* Run migrations (Drizzle CLI or npm script).
* Hit a `GET /health` endpoint to verify liveness.

Update `docs/README.md` as you add features:

* Setup steps
* Migration command
* Example curl requests
* Example JSON payloads

Update `docs/ARCHITECTURE.md` when you:

* Add new core tables
* Change the data model
* Add major modules/endpoints

---

## 8. How You Should Behave

When I (the human) ask you to implement or modify something:

1. **Read this CLAUDE.md first, respect the vision.**
2. Propose concrete changes:

   * which files to create/modify
   * what types and functions to add
3. Write code that is ready to paste into the repo.
4. If something in the repo conflicts with this spec, point it out and suggest a way to reconcile it.
5. If something is ambiguous, make a reasonable assumption and briefly document it in `ARCHITECTURE.md` or as a TODO comment.

You are allowed to refactor existing code if it improves:

* clarity
* consistency
* performance
* extensibility

But preserve behavior unless explicitly told to change it.

---

## 9. Future Roadmap (for context, not to implement yet)

Later, EidolonDB may add:

* Agent **self-models** (goals, values, skills).
* Planning/execution traces.
* A knowledge graph / causal reasoning layer.
* Admin dashboard & analytics.
* Multi-region replication, sharding, and serious SRE-level concerns.
* Additional SDKs (Python, Go, etc.)

For now, focus on:

1. **Solid backend architecture**
2. **Robust schema**
3. **Clean ingestion pipeline**
4. **Correct and flexible query & context building**

EidolonDB should feel like **Postgres + Vector + Graph + Memory**, wrapped in an API that’s delightful for AI engineers to build on.