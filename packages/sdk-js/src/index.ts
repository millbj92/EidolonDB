import { EidolonDBClient, type EidolonDBConfig } from './client.js';
import type {
  ConflictDetectInput,
  ConflictDetectResult,
  ConflictResolutionStrategy,
  CreateMemoryInput,
  IngestRequest,
  IngestResponse,
  Memory,
  MemorySearchResult,
  MemoryTier,
  SearchMemoriesOptions,
  TemporalFilter,
  ValidateResponse,
} from './types.js';
import { ArtifactsResource } from './resources/artifacts.js';
import { ConflictsResource } from './resources/conflicts.js';
import { ContextResource } from './resources/context.js';
import { EntitiesResource } from './resources/entities.js';
import { EventsResource } from './resources/events.js';
import { GrantsResource } from './resources/grants.js';
import { IngestResource } from './resources/ingest.js';
import { LifecycleResource } from './resources/lifecycle.js';
import { MemoriesResource } from './resources/memories.js';
import { RelationsResource } from './resources/relations.js';
import { FeedbackResource } from './resources/feedback.js';

export { EidolonDBClient, EidolonDBError, type EidolonDBConfig } from './client.js';
export * from './types.js';
export type { TemporalFilter } from './types.js';
export { MemoriesResource } from './resources/memories.js';
export { EntitiesResource } from './resources/entities.js';
export { ArtifactsResource } from './resources/artifacts.js';
export { RelationsResource } from './resources/relations.js';
export { EventsResource } from './resources/events.js';
export { ContextResource } from './resources/context.js';
export { LifecycleResource } from './resources/lifecycle.js';
export { IngestResource } from './resources/ingest.js';
export { FeedbackResource } from './resources/feedback.js';
export { GrantsResource } from './resources/grants.js';
export { ConflictsResource } from './resources/conflicts.js';

export class EidolonDB {
  private readonly client: EidolonDBClient;
  readonly memories: MemoriesResource;
  readonly entities: EntitiesResource;
  readonly artifacts: ArtifactsResource;
  readonly relations: RelationsResource;
  readonly events: EventsResource;
  readonly context: ContextResource;
  readonly lifecycle: LifecycleResource;
  readonly feedback: FeedbackResource;
  readonly grants: GrantsResource;
  readonly conflicts: ConflictsResource;
  private readonly _ingest: IngestResource;

  constructor(config: EidolonDBConfig) {
    this.client = new EidolonDBClient(config);
    this.memories = new MemoriesResource(this.client);
    this.entities = new EntitiesResource(this.client);
    this.artifacts = new ArtifactsResource(this.client);
    this.relations = new RelationsResource(this.client);
    this.events = new EventsResource(this.client);
    this.context = new ContextResource(this.client);
    this.lifecycle = new LifecycleResource(this.client);
    this.feedback = new FeedbackResource(this.client);
    this.grants = new GrantsResource(this.client);
    this.conflicts = new ConflictsResource(this.client);
    this._ingest = new IngestResource(this.client);
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
   * @param query - Semantic search query
   * @param k - Number of results to return (default: 5)
   * @param sessionNumber - If provided, restrict recall to a specific session number.
   *   Pass a positive integer for absolute session number (e.g. 3 = session 3),
   *   or a negative integer for relative offset (e.g. -1 = last session, -2 = two sessions ago).
   */
  async recall(query: string, k = 5, sessionNumber?: number): Promise<string[]> {
    const options: SearchMemoriesOptions = { k };

    if (sessionNumber !== undefined) {
      const temporal: TemporalFilter =
        sessionNumber < 0
          ? { mode: 'session-relative', sessionOffset: sessionNumber }
          : { mode: 'session-relative', sessionNumber };
      options.temporal = temporal;
    }

    const results = await this.memories.search(query, options);
    return results.map((result) => result.memory.content);
  }

  /**
   * Convenience conflict detection API.
   */
  detectConflicts(options?: ConflictDetectInput): Promise<ConflictDetectResult> {
    return this.conflicts.detect(options);
  }

  /**
   * Validate whether a claim is supported, contradicted, or unverified by stored memories.
   */
  validate(
    claim: string,
    options?: { agentEntityId?: string; k?: number; threshold?: number; tier?: string }
  ): Promise<ValidateResponse> {
    return this.client.request<ValidateResponse>('POST', '/validate', {
      claim,
      ...options,
    });
  }

  /**
   * Convenience conflict resolution API.
   */
  resolveConflict(
    memoryIdA: string,
    memoryIdB: string,
    strategy: ConflictResolutionStrategy
  ): Promise<{ ok: boolean }> {
    return this.conflicts.resolve({ memoryIdA, memoryIdB, strategy });
  }
}
