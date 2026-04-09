# EidolonDB

**Persistent, time-aware memory for AI agents.** EidolonDB gives your LLM agents cross-session recall, hallucination resistance, and episodic memory — without building any of it yourself.

```
Baseline agent:  "I don't have access to previous conversations."
EidolonDB agent: "You decided on Redis with a 5-minute TTL last session."
```

---

## What it does

- **Cross-session recall** — facts, preferences, and decisions persist across conversations
- **Hallucination resistance** — rejects false premises when they contradict stored memory
- **Auto-extraction** — feed raw conversation transcripts; EidolonDB extracts and classifies facts automatically
- **Three memory tiers** — `short_term` → `episodic` → `semantic` with lifecycle promotion and decay
- **Session-relative temporal queries** — "what did we do last session?" returns the right session's context
- **Provenance graph** — track where every memory came from

---

## Quickstart (5 minutes)

### Prerequisites

- Docker + Docker Compose
- Node.js 20+ and pnpm
- An OpenAI API key

### 1. Clone and install

```bash
git clone https://github.com/your-org/eidolondb.git
cd eidolondb
pnpm install
```

### 2. Start the stack

```bash
cd infra
OPENAI_API_KEY=sk-... docker compose up -d
```

This starts:
- **PostgreSQL + pgvector** on port `5492`
- **EidolonDB server** on port `3000`

### 3. Apply migrations

Migrations are not auto-applied on startup. Run them manually after first boot:

```bash
# Apply all migrations in order
for f in apps/server/drizzle/*.sql; do
  docker exec eidolondb-postgres psql -U eidolon -d eidolondb -f /dev/stdin < "$f"
done
```

Or apply them individually:

```bash
docker exec eidolondb-postgres psql -U eidolon -d eidolondb \
  -c "$(cat apps/server/drizzle/0000_spotty_jetstream.sql)"
# repeat for 0001, 0002, 0003...
```

### 4. Verify it's running

```bash
curl http://localhost:3000/health
# {"status":"healthy","services":{"database":"connected"}}
```

### 5. Store and retrieve a memory

```bash
# Store a fact via auto-extraction (recommended)
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: my-app" \
  -d '{
    "source": "chat",
    "autoStore": true,
    "content": "USER: I prefer dark mode. I use Vim keybindings.\nASSISTANT: Got it, noted!"
  }'

# Query relevant memories
curl -X POST http://localhost:3000/memories/query \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: my-app" \
  -d '{"text": "what are my editor preferences?", "k": 5}'
```

---

## SDK

### JavaScript / TypeScript

```bash
npm install @eidolondb/client
```

```typescript
import { EidolonClient } from "@eidolondb/client";

const client = new EidolonClient({
  baseUrl: "http://localhost:3000",
  tenantId: "my-app",
});

// Store a session transcript
await client.ingest("USER: My name is Sam. I prefer afternoon meetings.\nASSISTANT: Noted!");

// Recall relevant memories before an LLM turn
const memories = await client.recall("what's my name?");
// → ["User's name is Sam", "User prefers afternoon meetings (2–4 PM)"]
```

### Python

```bash
pip install eidolondb
```

```python
from eidolondb import EidolonClient

client = EidolonClient(base_url="http://localhost:3000", tenant_id="my-app")

# Store
client.ingest("USER: My name is Sam. I prefer afternoon meetings.")

# Recall
memories = client.recall("what's my name?")
```

See `prompts/` for full wiring examples with OpenAI and Anthropic SDKs.

---

## API Reference

All requests require the `x-tenant-id` header for multi-tenant isolation.

### Core endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/ingest` | Auto-extract + store memories from raw text |
| `POST` | `/memories/query` | Semantic search with optional temporal filters |
| `GET` | `/memories` | List memories (paginated) |
| `PATCH` | `/memories/:id` | Update importance, tags, tier |
| `DELETE` | `/memories/:id` | Delete a memory |
| `POST` | `/memories/:id/access` | Record an access event |
| `POST` | `/lifecycle/run` | Run tier promotion + decay |
| `POST` | `/context/build` | Build LLM-ready context block |
| `GET` | `/memories/stats` | Aggregate stats |

### Ingest (recommended storage method)

```bash
POST /ingest
{
  "source": "chat",          # chat | note | event | document | system
  "autoStore": true,         # let EidolonDB extract + classify facts
  "content": "<transcript>", # raw text to extract from
  "metadata": {
    "sessionNumber": 2       # optional — enables session-relative temporal queries
  }
}
```

### Memory query

```bash
POST /memories/query
{
  "text": "what port did we decide on?",  # semantic search query
  "k": 5,                                  # max results
  "tier": "episodic",                      # optional filter
  "tags": ["decision"],                    # optional filter

  # Optional temporal filter:
  "temporal": {
    "mode": "session-relative",
    "sessionOffset": -1     # -1 = last session, -2 = two sessions ago
  }
}
```

---

## Memory tiers

| Tier | Lifetime | Use for |
|------|----------|---------|
| `short_term` | Hours | Working context, current session |
| `episodic` | Days–weeks | Session logs, recent decisions |
| `semantic` | Permanent | Distilled knowledge, preferences |

Run `POST /lifecycle/run` to promote/decay/archive memories based on age and access patterns.

---

## Project structure

```
eidolondb/
├── apps/
│   ├── server/          # Fastify API server
│   │   ├── src/modules/ # memories, ingest, lifecycle, relations, events...
│   │   └── drizzle/     # SQL migration files (apply manually)
│   ├── web/             # Next.js dashboard (cloud)
│   └── gateway/         # Auth proxy for cloud deployment
├── packages/
│   ├── sdk-js/          # @eidolondb/client (npm)
│   └── sdk-python/      # eidolondb (PyPI)
├── eval/                # Eval harness (3-agent: baseline, RAG, EidolonDB)
├── prompts/             # Starter system prompts + SDK wiring examples
├── docs/                # Architecture, roadmap, specs
└── infra/               # Docker Compose, Dockerfile
```

---

## Migrations

Migrations live in `apps/server/drizzle/`. They are **not auto-applied** on server start.

To generate a new migration after changing the Drizzle schema:

```bash
pnpm --filter @eidolondb/server db:generate
```

To apply manually:

```bash
docker exec eidolondb-postgres psql -U eidolon -d eidolondb \
  -c "$(cat apps/server/drizzle/<new-migration>.sql)"
```

---

## Running the eval suite

The eval measures memory impact across 8 scenarios with three agents: no-memory baseline, RAG baseline (TF-IDF), and EidolonDB.

```bash
OPENAI_API_KEY=sk-... npx tsx eval/run.ts
```

Results are saved to `eval/results/`. See `docs/EVAL_LIMITATIONS.md` for known gaps and edge cases.

Latest results:
- **No-memory baseline:** 0.187 overall
- **RAG baseline:** ~0.68 overall  
- **EidolonDB:** 0.959 overall

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ | — | Used for embeddings (`text-embedding-3-small`) and ingest extraction |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `PORT` | | `3000` | Server port |
| `HOST` | | `0.0.0.0` | Server bind address |
| `NODE_ENV` | | `development` | `development` or `production` |

---

## Reliability

EidolonDB is not a database. It's a memory system — and memory, like human memory, is probabilistic.

- **Recall is high but not guaranteed.** Dense sessions, ambiguous phrasing, or rapidly changing facts reduce extraction accuracy.
- **Hallucination resistance works on what's stored.** If a fact was never ingested or extraction missed it, the system can't reject a false premise about it.
- **Temporal queries are session-aware, not omniscient.** "Last session" queries work well; open-ended calendar queries are improving.
- **Known limitations** are documented in [`docs/EVAL_LIMITATIONS.md`](docs/EVAL_LIMITATIONS.md).

For production use, we recommend running `POST /lifecycle/run` regularly and monitoring retrieval quality via the feedback API.

> **SLA note:** Production SLAs cover uptime and API latency. Recall accuracy is probabilistic by nature — this is true of all memory systems, including RAG and vector DBs.

---

## License

MIT
