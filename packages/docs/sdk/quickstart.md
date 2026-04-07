# SDK Quickstart

## Node.js Quickstart

```ts
import { EidolonDB } from '@eidolondb/client';

const db = new EidolonDB({ url: 'http://localhost:3000', tenant: 'my-app' });

await db.memories.create({
  tier: 'semantic',
  content: 'User prefers dark mode',
  importanceScore: 0.9,
  tags: ['preference'],
});

const results = await db.memories.search('user preferences', { k: 10 });
const ingested = await db.ingest('Today we decided to use Fastify for the API. Port is 4000.', {
  source: 'chat',
});

const lifecycle = await db.lifecycle.run({ dryRun: true });

console.log({ results: results.length, accepted: ingested.summary.accepted, lifecycleRun: lifecycle.runId });
```

## Browser Usage

The SDK works in modern browsers where `fetch` is available.

```ts
const db = new EidolonDB({
  url: 'https://api.example.com',
  tenant: 'browser-app',
});
```

## Custom Fetch (Node.js < 18 or custom runtime)

```ts
import fetch from 'node-fetch';
import { EidolonDB } from '@eidolondb/client';

const db = new EidolonDB({
  url: 'http://localhost:3000',
  tenant: 'my-app',
  fetch: fetch as unknown as typeof globalThis.fetch,
});
```
