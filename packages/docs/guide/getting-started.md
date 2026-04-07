# Getting Started

## Prerequisites

- Docker + Docker Compose
- Node.js 18+
- npm, pnpm, or yarn

## 1. Start EidolonDB with Docker Compose

From the monorepo root, start the local stack:

```bash
cd ~/Projects/EidolonDB
docker compose -f infra/docker-compose.yml up -d
```

This starts Postgres + pgvector and the API service (default `http://localhost:3000`).

## 2. Install the JavaScript SDK

```bash
npm install @eidolondb/client
```

## 3. Create a client

```ts
import { EidolonDB } from '@eidolondb/client';

const db = new EidolonDB({
  url: 'http://localhost:3000',
  tenant: 'my-app',
});
```

## 4. Remember and recall

```ts
await db.remember('Jordan leads backend development', {
  importance: 0.9,
  tags: ['team', 'ownership'],
});

const recalled = await db.recall('who leads backend?', 5);
console.log(recalled);
```

## 5. Ingest a conversation

```ts
const ingestResult = await db.ingest(
  'Today we decided to use Fastify for the API. The service runs on port 4000.',
  {
    source: 'chat',
    sessionId: 'session-001',
    debug: true,
  }
);

console.log(ingestResult.summary);
```

## Next

- Learn the memory model: [Concepts](/guide/concepts)
- Understand tier behavior: [Tiers](/guide/tiers)
- Tune retrieval quality: [Scoring](/guide/scoring)
- Browse raw endpoints: [API Overview](/api/overview)
