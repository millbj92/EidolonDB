# @eidolondb/client

Official JavaScript/TypeScript client for EidolonDB — the self-managing memory engine for AI agents.

## Install

```bash
npm install @eidolondb/client
```

## Quick start

```ts
import { EidolonDB } from '@eidolondb/client';

const db = new EidolonDB({ url: 'http://localhost:3000', tenant: 'my-app' });

await db.memories.create({ tier: 'semantic', content: 'User prefers dark mode', importanceScore: 0.9, tags: ['preference'] });
const results = await db.memories.search('user preferences', { k: 10 });
const ingested = await db.ingest('Today we decided to use Fastify for the API. Port is 4000.', { source: 'chat' });
const lifecycle = await db.lifecycle.run({ dryRun: true });
```

Convenience methods for the common path:

```ts
await db.remember('User likes concise answers');
const recall = await db.recall('user preferences', 5);
const search = await db.search('preference memory', { k: 8 });
await db.ingest('Meeting summary...', { source: 'note' });
```

## API reference

### memories

```ts
db.memories.create(input)
db.memories.get(id)
db.memories.list(options?)
db.memories.update(id, input)
db.memories.delete(id)
db.memories.search(text, options?)
db.memories.recordAccess(id)
db.memories.stats()
```

Example:

```ts
const top = await db.memories.search('project architecture', { k: 5, tiers: ['semantic'] });
```

### ingest

```ts
db.ingest(content, options?)
db.search(text, options?)
db.remember(content, options?)
db.recall(query, k?)
```

Example:

```ts
await db.ingest('Decision: use PostgreSQL for durability.', { source: 'chat', debug: true });
```

### lifecycle

```ts
db.lifecycle.run(options?)
db.lifecycle.listRuns(options?)
```

Example:

```ts
const run = await db.lifecycle.run({ dryRun: true });
```

### relations

```ts
db.relations.create(input)
db.relations.list(options?)
db.relations.get(id)
db.relations.delete(id)
db.relations.traverse(options)
```

Example:

```ts
const graph = await db.relations.traverse({
  startType: 'entity',
  startId: '<entity-id>',
  depth: 2,
  direction: 'both',
});
```

### events

```ts
db.events.create(input)
db.events.list(options?)
db.events.get(id)
db.events.timeline(options?)
```

Example:

```ts
const timeline = await db.events.timeline({ days: 14 });
```

### entities

```ts
db.entities.create(input)
db.entities.get(id)
db.entities.list(options?)
db.entities.update(id, input)
db.entities.delete(id)
```

Example:

```ts
const user = await db.entities.create({ type: 'user', name: 'Alice' });
```

### context

```ts
db.context.build(input)
```

Example:

```ts
const context = await db.context.build({
  currentInput: 'How should I respond to this user?',
  maxTokens: 4000,
});
```

### artifacts

```ts
db.artifacts.create(input)
db.artifacts.get(id)
db.artifacts.delete(id)
```

Example:

```ts
const artifact = await db.artifacts.create({
  kind: 'document',
  mimeType: 'text/plain',
  content: 'Internal design notes',
});
```

## Error handling

All API failures throw `EidolonDBError`.

```ts
import { EidolonDBError } from '@eidolondb/client';

try {
  await db.memories.get('<id>');
} catch (error) {
  if (error instanceof EidolonDBError) {
    console.error(error.status, error.message, error.body);
  }
}
```

## Using with Node.js < 18

Pass a custom `fetch` implementation when native `globalThis.fetch` is unavailable:

```ts
import fetch from 'node-fetch';
import { EidolonDB } from '@eidolondb/client';

const db = new EidolonDB({
  url: 'http://localhost:3000',
  tenant: 'my-app',
  fetch: fetch as unknown as typeof globalThis.fetch,
});
```
