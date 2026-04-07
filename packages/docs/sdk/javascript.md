# JavaScript / TypeScript SDK

Package: `@eidolondb/client`

```bash
npm install @eidolondb/client
```

## Client Setup

```ts
import { EidolonDB } from '@eidolondb/client';

const db = new EidolonDB({
  url: 'http://localhost:3000',
  tenant: 'my-app',
  timeout: 30_000,
  // fetch: customFetch
});
```

Configuration type:

```ts
interface EidolonDBConfig {
  url: string;
  tenant: string;
  fetch?: typeof fetch;
  timeout?: number;
}
```

## Top-Level Convenience Methods

```ts
db.ingest(content: string, options?: Omit<IngestRequest, 'content'>): Promise<IngestResponse>
db.search(text: string, options?: SearchMemoriesOptions): Promise<MemorySearchResult[]>
db.remember(
  content: string,
  options?: { importance?: number; tags?: string[]; tier?: MemoryTier }
): Promise<Memory>
db.recall(query: string, k?: number): Promise<string[]>
```

## Resource Methods

### `memories`

```ts
db.memories.create(input: CreateMemoryInput): Promise<Memory>
db.memories.get(id: string): Promise<Memory>
db.memories.list(options?: ListMemoriesOptions): Promise<ListMemoriesResponse>
db.memories.update(id: string, input: UpdateMemoryInput): Promise<Memory>
db.memories.delete(id: string): Promise<void>
db.memories.search(text: string, options?: SearchMemoriesOptions): Promise<MemorySearchResult[]>
db.memories.recordAccess(id: string): Promise<Memory>
db.memories.stats(): Promise<MemoryStatsResponse>
```

### `ingest`

```ts
db.ingest(content: string, options?: Omit<IngestRequest, 'content'>): Promise<IngestResponse>
```

### `lifecycle`

```ts
db.lifecycle.run(options?: LifecycleRunRequest): Promise<LifecycleRunResponse>
db.lifecycle.listRuns(options?: { limit?: number }): Promise<LifecycleRun[]>
```

### `relations`

```ts
db.relations.create(input: CreateRelationInput): Promise<Relation>
db.relations.list(options?: ListRelationsOptions): Promise<Relation[]>
db.relations.get(id: string): Promise<Relation>
db.relations.delete(id: string): Promise<void>
db.relations.traverse(options: TraverseOptions): Promise<TraverseResult>
```

### `events`

```ts
db.events.create(input: CreateEventInput): Promise<Event>
db.events.list(options?: ListEventsOptions): Promise<Event[]>
db.events.get(id: string): Promise<Event>
db.events.timeline(options?: TimelineOptions): Promise<TimelineEntry[]>
```

### `entities`

```ts
db.entities.create(input: CreateEntityInput): Promise<Entity>
db.entities.get(id: string): Promise<Entity>
db.entities.list(options?: ListEntitiesOptions): Promise<Entity[]>
db.entities.update(id: string, input: UpdateEntityInput): Promise<Entity>
db.entities.delete(id: string): Promise<void>
```

### `context`

```ts
db.context.build(input: ContextBuildInput): Promise<ContextBuildResponse>
```

## Error Handling

All API failures throw `EidolonDBError`.

```ts
import { EidolonDBError } from '@eidolondb/client';

try {
  await db.memories.get('memory-id');
} catch (error) {
  if (error instanceof EidolonDBError) {
    console.error(error.status, error.message, error.body);
  }
}
```

`EidolonDBError` shape:

```ts
class EidolonDBError extends Error {
  status: number;
  body: unknown;
}
```
