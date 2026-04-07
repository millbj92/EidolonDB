import { EidolonDBClient, type EidolonDBConfig } from './client.js';
import type {
  CreateMemoryInput,
  IngestRequest,
  IngestResponse,
  Memory,
  MemorySearchResult,
  MemoryTier,
  SearchMemoriesOptions,
} from './types.js';
import { ArtifactsResource } from './resources/artifacts.js';
import { ContextResource } from './resources/context.js';
import { EntitiesResource } from './resources/entities.js';
import { EventsResource } from './resources/events.js';
import { IngestResource } from './resources/ingest.js';
import { LifecycleResource } from './resources/lifecycle.js';
import { MemoriesResource } from './resources/memories.js';
import { RelationsResource } from './resources/relations.js';
import { FeedbackResource } from './resources/feedback.js';

export { EidolonDBClient, EidolonDBError, type EidolonDBConfig } from './client.js';
export * from './types.js';
export { MemoriesResource } from './resources/memories.js';
export { EntitiesResource } from './resources/entities.js';
export { ArtifactsResource } from './resources/artifacts.js';
export { RelationsResource } from './resources/relations.js';
export { EventsResource } from './resources/events.js';
export { ContextResource } from './resources/context.js';
export { LifecycleResource } from './resources/lifecycle.js';
export { IngestResource } from './resources/ingest.js';
export { FeedbackResource } from './resources/feedback.js';

export class EidolonDB {
  readonly memories: MemoriesResource;
  readonly entities: EntitiesResource;
  readonly artifacts: ArtifactsResource;
  readonly relations: RelationsResource;
  readonly events: EventsResource;
  readonly context: ContextResource;
  readonly lifecycle: LifecycleResource;
  readonly feedback: FeedbackResource;
  private readonly _ingest: IngestResource;

  constructor(config: EidolonDBConfig) {
    const client = new EidolonDBClient(config);
    this.memories = new MemoriesResource(client);
    this.entities = new EntitiesResource(client);
    this.artifacts = new ArtifactsResource(client);
    this.relations = new RelationsResource(client);
    this.events = new EventsResource(client);
    this.context = new ContextResource(client);
    this.lifecycle = new LifecycleResource(client);
    this.feedback = new FeedbackResource(client);
    this._ingest = new IngestResource(client);
  }

  /**
   * Convenience ingest API with content-first signature.
   */
  ingest(content: string, options?: Omit<IngestRequest, 'content'>): Promise<IngestResponse> {
    return this._ingest.run({
      content,
      source: options?.source ?? 'chat',
      ...options,
    });
  }

  /**
   * Convenience semantic memory search.
   */
  search(text: string, options?: SearchMemoriesOptions): Promise<MemorySearchResult[]> {
    return this.memories.search(text, options);
  }

  /**
   * Convenience memory creation for typical semantic facts.
   */
  remember(
    content: string,
    options?: { importance?: number; tags?: string[]; tier?: MemoryTier }
  ): Promise<Memory> {
    const input: CreateMemoryInput = {
      tier: options?.tier ?? 'semantic',
      content,
      importanceScore: options?.importance,
      tags: options?.tags,
    };

    return this.memories.create(input);
  }

  /**
   * Convenience recall returning plain memory contents.
   */
  async recall(query: string, k = 5): Promise<string[]> {
    const results = await this.memories.search(query, { k });
    return results.map((result) => result.memory.content);
  }
}
