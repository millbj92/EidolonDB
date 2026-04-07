# EidolonDB Roadmap — Missing Features Scoped

**Date:** 2026-04-07
**Current state:** 3,274 lines of TypeScript across 38 files. Fastify + Drizzle + Postgres/pgvector. 6 modules (health, entities, artifacts, memories, relations, events), context builder. Monorepo with pnpm workspaces.

---

## Feature 1: Auto-Extraction Pipeline

**What:** Feed a conversation transcript or raw text → EidolonDB automatically extracts structured memories, classifies them into tiers, assigns importance, generates tags, and stores them.

**Why this is #1:** This is the difference between "a database for memories" and "a memory system." Mem0's entire value prop is automatic extraction. Right now EidolonDB requires the caller to decide what to push, what tier, what importance, what tags. That's too much friction for adoption.

### Architecture

```
Input (conversation/text)
    ↓
POST /ingest
    ↓
┌─────────────────────────────┐
│  Extraction Pipeline        │
│  1. LLM call to extract     │
│     structured memories     │
│  2. Classify tier            │
│  3. Score importance         │
│  4. Generate tags            │
│  5. Detect entities/relations│
│  6. Dedup against existing   │
└─────────────────────────────┘
    ↓
Memories + Relations + Embeddings stored
```

### New Components

1. **`POST /ingest` endpoint** — accepts raw text, conversation arrays, or structured messages
   - Input formats: plain text, OpenAI message array `[{role, content}]`, custom conversation format
   - Options: `agentEntityId`, `userEntityId`, `sessionId`, `source` (for tracing)
   - Returns: extracted memories, relations created, dedup stats

2. **LLM extraction module** (`apps/server/src/common/llm/`)
   - Abstract `LLMProvider` interface (like `EmbeddingsProvider`)
   - OpenAI implementation first (use `gpt-4o-mini` for cost efficiency — extraction doesn't need frontier models)
   - Structured output with JSON mode or function calling
   - Extraction prompt that returns: `[{ content, tier, importance, tags, entities_mentioned }]`

3. **Deduplication service**
   - Before storing, embed the candidate memory and search for high-similarity existing memories (cosine > 0.92)
   - If near-duplicate found: merge (update existing memory, bump importance) vs skip vs store-and-link
   - Configurable strategy per tenant

4. **Entity extraction + auto-relations**
   - Extract mentioned entities (people, projects, tools) from memories
   - Auto-create entity nodes if they don't exist
   - Auto-create `MENTIONS` relations between the memory and extracted entities

### Effort Estimate

| Component | Lines (est.) | Time |
|-----------|-------------|------|
| LLM provider interface + OpenAI impl | ~200 | 1 day |
| Extraction prompt engineering + structured output | ~150 | 1 day |
| Ingest endpoint + pipeline orchestration | ~400 | 2 days |
| Deduplication service | ~200 | 1 day |
| Entity extraction + auto-relations | ~250 | 1 day |
| Tests + integration testing | ~300 | 1 day |
| **Total** | **~1,500** | **7 days** |

### Dependencies
- New env var: `LLM_API_KEY` (or reuse `OPENAI_API_KEY`)
- New config: LLM model selection, extraction prompt templates
- New dependency: none (use native `fetch` to call OpenAI, same as embeddings)

---

## Feature 2: Tier Promotion & Decay System

**What:** Automated lifecycle management that moves memories between tiers based on age, access patterns, and content analysis.

**Why:** The three tiers exist but nothing moves between them. Without lifecycle management, short_term fills up forever, episodic never gets distilled, and the tier model is just labels.

### Architecture

```
┌─────────────┐    promote     ┌─────────────┐    distill     ┌─────────────┐
│ short_term  │ ──────────────→│  episodic   │ ──────────────→│  semantic   │
│ (hours)     │    or expire   │ (days-weeks)│  or archive    │ (permanent) │
└─────────────┘                └─────────────┘                └─────────────┘
       ↓ expire (24h)                ↓ decay (30d, 0 access)
    [deleted]                    [archived/deleted]
```

### New Components

1. **`POST /lifecycle/run` endpoint** — trigger lifecycle processing manually or via cron
   - Processes all memories for a tenant
   - Returns: `{ promoted, expired, distilled, archived, unchanged }`

2. **Lifecycle rules engine** (`apps/server/src/modules/lifecycle/`)
   - Configurable per-tenant rules:
     ```json
     {
       "short_term": {
         "maxAge": "24h",
         "promoteIf": { "accessCount": ">= 2" },
         "promoteTo": "episodic",
         "expireIfUnaccessed": true
       },
       "episodic": {
         "distillAfter": "7d",
         "distillIf": { "accessCount": ">= 3", "importanceScore": ">= 0.7" },
         "distillTo": "semantic",
         "archiveAfter": "30d",
         "archiveIf": { "accessCount": "== 0" }
       }
     }
     ```
   - Rules are stored per-tenant in a new `tenant_config` table or as entity properties

3. **Distillation service**
   - When promoting episodic → semantic, use LLM to extract the core fact/knowledge from the episodic context
   - E.g., "Session 2026-04-07: Fixed Codex CLI auth bug using codex login --with-api-key" → "Codex CLI v0.118.0: use `codex login --with-api-key` for auth. Env var alone fails on REST fallback."
   - Creates a new semantic memory linked to the source episodic memory via relation

4. **Recency score decay job**
   - Optional periodic job that updates stored `recencyScore` values
   - Or: remove the stored field entirely, always compute on-the-fly (simpler)

### Effort Estimate

| Component | Lines (est.) | Time |
|-----------|-------------|------|
| Lifecycle rules engine + config | ~300 | 2 days |
| Promotion/expiry processor | ~250 | 1 day |
| Distillation service (LLM-powered) | ~200 | 1 day |
| Lifecycle endpoint + scheduling | ~150 | 0.5 day |
| Tenant config storage | ~150 | 0.5 day |
| Tests | ~200 | 1 day |
| **Total** | **~1,250** | **6 days** |

### Dependencies
- Depends on Feature 1's LLM provider (for distillation)
- New table or entity-based config for lifecycle rules

---

## Feature 3: Python & JavaScript SDKs

**What:** Thin client libraries that wrap the HTTP API with typed methods, connection pooling, and convenience helpers.

**Why:** Table stakes for developer adoption. Nobody wants to write raw `fetch` calls with `x-tenant-id` headers. Mem0 and Zep both have Python SDKs as their primary interface.

### Architecture

```
packages/
├── sdk-python/          # PyPI: eidolondb
│   ├── eidolondb/
│   │   ├── client.py    # Main client class
│   │   ├── types.py     # Pydantic models
│   │   ├── memories.py  # Memory operations
│   │   ├── relations.py # Relation operations
│   │   ├── events.py    # Event operations
│   │   └── ingest.py    # Ingest helper
│   ├── pyproject.toml
│   └── README.md
│
├── sdk-js/              # npm: @eidolondb/client
│   ├── src/
│   │   ├── client.ts    # Main client class
│   │   ├── types.ts     # TypeScript types
│   │   ├── memories.ts
│   │   ├── relations.ts
│   │   ├── events.ts
│   │   └── ingest.ts
│   ├── package.json
│   └── README.md
```

### API Design (both languages)

```python
from eidolondb import EidolonDB

db = EidolonDB(url="http://localhost:3000", tenant="my-app")

# Push a memory
mem = db.memories.create(
    content="User prefers dark mode",
    tier="semantic",
    importance=0.9,
    tags=["preference", "ui"]
)

# Semantic search
results = db.memories.search("user preferences", k=10)

# Ingest a conversation
extracted = db.ingest(
    messages=[{"role": "user", "content": "..."}, ...],
    agent_id="agent-123"
)

# List with filters
memories = db.memories.list(tier="semantic", tag="preference", limit=50)

# Update
db.memories.update(mem.id, importance=0.95, tags=["preference", "ui", "confirmed"])

# Relations
db.relations.create(
    type="MENTIONED_IN",
    from_type="entity", from_id="user-1",
    to_type="memory", to_id=mem.id
)

# Graph traversal
graph = db.relations.traverse(start_type="entity", start_id="user-1", depth=2)

# Context builder
context = db.context.build(
    current_input="How does the user like their UI?",
    agent_id="agent-123",
    max_tokens=4000
)
```

### Effort Estimate

| Component | Lines (est.) | Time |
|-----------|-------------|------|
| JS SDK (TypeScript, npm package) | ~800 | 3 days |
| Python SDK (Pydantic, PyPI package) | ~800 | 3 days |
| Shared test suite / integration tests | ~400 | 2 days |
| Documentation + README + examples | ~300 | 1 day |
| CI/CD for publishing (GitHub Actions) | ~100 | 0.5 day |
| **Total** | **~2,400** | **9.5 days** |

### Dependencies
- None (wraps existing HTTP API)
- pnpm workspace already supports `packages/*`

---

## Feature 4: Multi-Agent Memory Sharing & Permissions

**What:** Allow multiple agents to have their own memory spaces with controlled sharing — "Agent A can read Agent B's semantic memories but not its episodic ones."

**Why:** Real-world deployments have multiple agents (like our setup: main, news, coder). Right now they either share everything (same tenant) or are completely isolated (different tenants). There's no middle ground.

### Architecture

```
Tenant: "my-app"
├── Agent: "orchestrator" (owner)
│   ├── episodic: [private]
│   ├── semantic: [shared-read with all agents]
│   └── short_term: [private]
│
├── Agent: "researcher" 
│   ├── episodic: [private]
│   ├── semantic: [shared-read with orchestrator]
│   └── short_term: [private]
│
└── Shared Pool: [all agents can read/write]
    └── semantic: [project context, shared decisions]
```

### New Components

1. **Memory scoping** — new fields on memories:
   - `visibility`: `private | agent | shared | public`
   - `ownerAgentId`: which agent created this
   - Queries filter by visibility + requester agent ID

2. **Agent permissions table**
   ```sql
   CREATE TABLE agent_permissions (
     id UUID PRIMARY KEY,
     tenant_id TEXT NOT NULL,
     agent_entity_id UUID NOT NULL,
     target_agent_id UUID, -- null = all agents
     tier memory_tier,     -- null = all tiers
     permission TEXT NOT NULL CHECK(permission IN ('read', 'write', 'admin')),
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```

3. **Shared memory pools**
   - Memories with `visibility = shared` are queryable by any agent in the tenant
   - Useful for project-wide context that all agents should know

4. **Query enhancement**
   - All memory query endpoints accept optional `agentId` parameter
   - Results filtered by visibility + permissions
   - Context builder respects agent scoping

### Effort Estimate

| Component | Lines (est.) | Time |
|-----------|-------------|------|
| Schema changes (visibility, ownerAgentId) | ~100 | 0.5 day |
| Permissions table + CRUD | ~300 | 1.5 days |
| Query filtering by permissions | ~200 | 1 day |
| Shared memory pool logic | ~150 | 0.5 day |
| Migration for existing data | ~50 | 0.5 day |
| Tests | ~200 | 1 day |
| **Total** | **~1,000** | **5 days** |

### Dependencies
- Schema migration (new columns + table)
- Existing memories need default values for new fields

---

## Feature 5: Conflict Resolution & Deduplication

**What:** Detect when new memories contradict or duplicate existing ones, and resolve intelligently.

**Why:** Without this, memory stores accumulate stale and contradictory information. "User's favorite color is blue" and "User's favorite color is green" can both exist, confusing the agent.

### Architecture

```
New memory arrives
    ↓
┌─────────────────────────────┐
│  Similarity check           │
│  Embed candidate, search    │
│  for cosine > 0.85          │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│  Conflict detection         │
│  LLM judges: duplicate,     │
│  update, contradiction,     │
│  or unrelated               │
└─────────────────────────────┘
    ↓
Action:
  - duplicate → skip (return existing)
  - update → merge into existing, bump timestamp
  - contradiction → store both, flag for review, or keep newer
  - unrelated → store normally
```

### New Components

1. **Dedup check** (integrated into artifact autoProcess and ingest pipeline)
   - Before creating memory, run similarity search
   - If high similarity found, invoke conflict resolver

2. **Conflict resolver service**
   - LLM-powered judgment: given two memories, classify the relationship
   - Configurable strategy: `keep_newer`, `keep_both_flagged`, `merge`, `ask_user`
   - Merge logic: combine content, keep higher importance, union tags

3. **Conflict log**
   - New `memory_conflicts` table tracking detected conflicts and resolutions
   - Dashboard can show unresolved conflicts for human review

### Effort Estimate

| Component | Lines (est.) | Time |
|-----------|-------------|------|
| Similarity pre-check | ~100 | 0.5 day |
| LLM conflict classifier | ~200 | 1 day |
| Resolution strategies | ~250 | 1.5 days |
| Conflict log table + API | ~200 | 1 day |
| Integration into ingest + autoProcess | ~150 | 1 day |
| Tests | ~200 | 1 day |
| **Total** | **~1,100** | **6 days** |

### Dependencies
- Depends on Feature 1's LLM provider
- Partially overlaps with Feature 1's dedup service

---

## Feature 6: Documentation & Developer Experience

**What:** Complete docs site, quickstart guide, API reference, tutorials, and a landing page.

**Why:** You can't fundraise with a one-line README. You can't get adoption without a 5-minute quickstart. Zep's entire growth strategy was developer docs + framework integrations.

### Components

1. **Docs site** (VitePress or Docusaurus)
   - Quickstart (5 min to first memory stored)
   - Concepts (tiers, scoring, relations, events)
   - API Reference (generated from Zod schemas or OpenAPI)
   - Guides: "Memory for chatbots", "Memory for agent swarms", "Memory for RAG"
   - SDK docs (Python + JS)

2. **OpenAPI spec** — auto-generated from Fastify + Zod
   - Fastify has `@fastify/swagger` plugin for this
   - Enables Swagger UI at `/docs`

3. **Landing page**
   - Single-page marketing site
   - Architecture diagram, feature comparison vs Mem0/Zep/Letta
   - "Why EidolonDB" positioning

4. **README overhaul**
   - Badges, quickstart, architecture diagram, feature list
   - Link to docs site

### Effort Estimate

| Component | Lines/Pages (est.) | Time |
|-----------|-------------------|------|
| Docs site setup (VitePress) | ~20 pages | 2 days |
| API reference (OpenAPI + Swagger) | ~300 lines config | 1 day |
| Quickstart guide | 1 page | 0.5 day |
| Concept docs (tiers, scoring, etc.) | 5 pages | 1 day |
| SDK docs | 4 pages | 1 day |
| Landing page | 1 page | 1 day |
| README + badges + diagram | 1 file | 0.5 day |
| **Total** | **~30 pages + config** | **7 days** |

### Dependencies
- New dev dependency: `@fastify/swagger` + `@fastify/swagger-ui`
- New workspace package or separate repo for docs site

---

## Summary

| # | Feature | Effort | Priority | Revenue Impact |
|---|---------|--------|----------|---------------|
| 1 | Auto-Extraction Pipeline | 7 days | **P0** — killer feature | High (core differentiator) |
| 2 | Tier Promotion & Decay | 6 days | **P0** — makes tiers useful | Medium (enables intelligent memory) |
| 3 | Python & JS SDKs | 9.5 days | **P1** — adoption blocker | High (developer onboarding) |
| 4 | Multi-Agent Sharing | 5 days | **P2** — enterprise feature | Medium (enterprise sales) |
| 5 | Conflict Resolution | 6 days | **P2** — quality feature | Medium (data quality) |
| 6 | Documentation & DX | 7 days | **P1** — fundraising req | High (adoption + fundraising) |
| | **Total** | **40.5 days** | | |

### Recommended Build Order

**Phase 1 — Core Intelligence (2 weeks)**
- Feature 1: Auto-Extraction Pipeline
- Feature 2: Tier Promotion & Decay

**Phase 2 — Developer Experience (2 weeks)**
- Feature 3: SDKs (Python first, then JS)
- Feature 6: Documentation + OpenAPI + Landing page

**Phase 3 — Enterprise & Quality (1.5 weeks)**
- Feature 4: Multi-Agent Sharing
- Feature 5: Conflict Resolution

**Total: ~5.5 weeks of focused development** for a fundraise-ready product.

With a solo developer working full-time, this is a 6-8 week timeline accounting for integration testing, edge cases, and iteration. With Codex helping (as it did today), potentially faster — the CRUD work and boilerplate goes ~5x faster with AI pair programming.
