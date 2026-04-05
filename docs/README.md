# EidolonDB

AI-native memory database and context engine for LLM-based agents.

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose

### Setup

1. Clone the repository and install dependencies:

```bash
pnpm install
```

2. Start the database:

```bash
cd infra
docker compose up postgres -d
```

3. Copy the example environment file:

```bash
cp apps/server/.env.example apps/server/.env
```

4. Run database migrations:

```bash
pnpm db:push
```

5. Start the development server:

```bash
pnpm dev
```

### Using Docker Compose (Full Stack)

```bash
cd infra
docker compose up
```

This starts both PostgreSQL with pgvector and the EidolonDB server.

## API Endpoints

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected"
  }
}
```

### Create Entity

```bash
curl -X POST http://localhost:3000/entities \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: my-tenant" \
  -d '{
    "type": "user",
    "name": "John Doe",
    "properties": {
      "email": "john@example.com"
    },
    "tags": ["active"]
  }'
```

### Get Entity

```bash
curl http://localhost:3000/entities/{id} \
  -H "x-tenant-id: my-tenant"
```

### Create Artifact (with auto-processing)

```bash
curl -X POST http://localhost:3000/artifacts \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: my-tenant" \
  -d '{
    "kind": "text",
    "mimeType": "text/plain",
    "content": "Your long document content here...",
    "autoProcess": {
      "chunkSize": 1000,
      "chunkOverlap": 200,
      "generateEmbeddings": true,
      "memoryTier": "semantic"
    }
  }'
```

Response includes the artifact and created memories:
```json
{
  "data": {
    "artifact": { "id": "...", "kind": "text", ... },
    "memories": [
      { "id": "...", "content": "chunk 1...", "embeddingId": "..." },
      { "id": "...", "content": "chunk 2...", "embeddingId": "..." }
    ]
  }
}
```

### Get Artifact

```bash
curl http://localhost:3000/artifacts/{id} \
  -H "x-tenant-id: my-tenant"
```

### Query Memories

```bash
curl -X POST http://localhost:3000/memories/query \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: my-tenant" \
  -d '{
    "text": "What did we discuss about the project?",
    "k": 10,
    "tiers": ["semantic", "episodic"],
    "weights": {
      "semantic": 0.7,
      "recency": 0.2,
      "importance": 0.1
    }
  }'
```

Response:
```json
{
  "data": {
    "results": [
      {
        "memory": { "id": "...", "content": "...", "tier": "semantic" },
        "score": 0.85,
        "reasons": { "semantic": 0.9, "recency": 0.7, "importance": 0.5 }
      }
    ],
    "query": { "text": "...", "k": 10 }
  }
}
```

### Build Context

Build LLM-ready context from memories:

```bash
curl -X POST http://localhost:3000/context/build \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: my-tenant" \
  -d '{
    "currentInput": "Help me with the project timeline",
    "maxTokens": 4000,
    "agentEntityId": "agent-uuid",
    "userEntityId": "user-uuid",
    "goal": "Assist with project planning",
    "strategy": {
      "tiers": ["semantic", "episodic"],
      "perTierCaps": { "semantic": 20, "episodic": 10 }
    }
  }'
```

Response:
```json
{
  "data": {
    "messages": [
      { "role": "system", "content": "You are..." },
      { "role": "system", "content": "Relevant context from memory..." },
      { "role": "user", "content": "Help me with the project timeline" }
    ],
    "rawMemories": [...],
    "metadata": {
      "totalTokensEstimated": 1820,
      "memoriesIncluded": 5,
      "memoriesQueried": 30,
      "tiersQueried": ["semantic", "episodic"]
    }
  }
}
```

## Development

### Project Structure

```
eidolondb/
├── apps/
│   └── server/          # Main server application
│       └── src/
│           ├── modules/ # Feature modules
│           ├── common/  # Shared utilities
│           └── index.ts # Entry point
├── infra/               # Docker & infrastructure
├── docs/                # Documentation
└── CLAUDE.md            # AI assistant instructions
```

### Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Run production build
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:migrate` - Run migrations
- `pnpm db:push` - Push schema to database (dev)
