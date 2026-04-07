export type MemoryTier = 'short_term' | 'episodic' | 'semantic';
export type DedupStatus = 'new' | 'duplicate' | 'near_duplicate' | 'conflict' | 'needs_review';
export type IngestSource = 'chat' | 'note' | 'event' | 'document' | 'system';
export type RelationNodeType = 'entity' | 'artifact' | 'memory';

export interface Memory {
  id: string;
  tenantId: string;
  ownerEntityId: string | null;
  tier: MemoryTier;
  content: string;
  sourceArtifactId: string | null;
  sourceEventId: string | null;
  embeddingId: string | null;
  importanceScore: number | null;
  recencyScore: number | null;
  accessCount: number | null;
  lastAccessedAt: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  ownerEntityId?: string;
  tier: MemoryTier;
  content: string;
  sourceArtifactId?: string;
  sourceEventId?: string;
  importanceScore?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdateMemoryInput {
  content?: string;
  tier?: MemoryTier;
  importanceScore?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface MemoryQueryWeights {
  semantic?: number;
  recency?: number;
  importance?: number;
}

export interface SearchMemoriesOptions {
  k?: number;
  sessionId?: string;
  actorId?: string;
  ownerEntityId?: string;
  tiers?: MemoryTier[];
  tags?: string[];
  sourceArtifactId?: string;
  createdAfter?: string;
  createdBefore?: string;
  weights?: MemoryQueryWeights;
  minScore?: number;
}

export interface ListMemoriesOptions {
  offset?: number;
  limit?: number;
  tier?: MemoryTier;
  tag?: string;
  ownerEntityId?: string;
  sortBy?: 'createdAt' | 'importanceScore' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
}

export interface MemorySearchResult {
  memory: Memory;
  score: number;
  reasons?: {
    semantic?: number;
    recency?: number;
    importance?: number;
  };
}

export interface ListMemoriesResponse {
  memories: Memory[];
  total: number;
  offset: number;
  limit: number;
}

export interface MemoryStatsResponse {
  total: number;
  byTier: {
    episodic: number;
    semantic: number;
    short_term: number;
  };
  byDay: Array<{
    date: string;
    count: number;
  }>;
}

export interface MarkUsedResponse {
  updated: number;
  memoryIds: string[];
}

export interface RetrievalStatsResponse {
  memoryId: string;
  retrievalCount: number;
  usageCount: number;
  avgRelevanceFeedback: number | null;
  avgRetrievalScore: number | null;
  lastRetrievedAt: string | null;
}

export interface CandidateMemory {
  content: string;
  memoryType: MemoryTier;
  importance: number;
  confidence: number;
  tags: string[];
  sourceSpan: string;
  rationale: string;
}

export interface AcceptedMemory extends CandidateMemory {
  memoryId?: string;
  dedupStatus: DedupStatus;
}

export interface RejectedMemory extends CandidateMemory {
  dedupStatus: DedupStatus;
  reason: string;
}

export interface IngestRequest {
  content: string;
  source: IngestSource;
  actorId?: string;
  sessionId?: string;
  ownerEntityId?: string;
  autoStore?: boolean;
  debug?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IngestResponse {
  success: boolean;
  traceId: string;
  summary: {
    candidates: number;
    accepted: number;
    rejected: number;
  };
  acceptedMemories: AcceptedMemory[];
  rejectedMemories: RejectedMemory[];
  warnings: string[];
  debug?: {
    normalizedInput: string;
    extractorVersion: string;
    promptVersion: string;
    durationMs: number;
  };
}

export interface LifecycleRunRequest {
  dryRun?: boolean;
  triggeredBy?: string;
}

export interface LifecycleAction {
  memoryId: string;
  action: 'expired' | 'promoted' | 'distilled' | 'archived' | 'unchanged' | 'error';
  fromTier: MemoryTier;
  toTier?: MemoryTier;
  reason: string;
  newMemoryId?: string;
}

export interface LifecycleRunResponse {
  success: boolean;
  runId: string;
  dryRun: boolean;
  summary: {
    expired: number;
    promoted: number;
    distilled: number;
    archived: number;
    unchanged: number;
    durationMs: number;
  };
  details: LifecycleAction[];
  errors: string[];
}

export interface LifecycleRun {
  id: string;
  tenantId: string;
  triggeredBy: string;
  durationMs: number | null;
  expired: number;
  promoted: number;
  distilled: number;
  archived: number;
  unchanged: number;
  errors: string[];
  completedAt: string | null;
  createdAt: string;
}

export interface Entity {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  primaryArtifactId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityInput {
  type: string;
  name: string;
  properties?: Record<string, unknown>;
  primaryArtifactId?: string;
  tags?: string[];
}

export interface UpdateEntityInput {
  type?: string;
  name?: string;
  properties?: Record<string, unknown>;
  primaryArtifactId?: string | null;
  tags?: string[];
}

export interface ListEntitiesOptions {
  type?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface Artifact {
  id: string;
  tenantId: string;
  kind: string;
  mimeType: string;
  content: string;
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactAutoProcess {
  chunkSize?: number;
  chunkOverlap?: number;
  generateEmbeddings?: boolean;
  ownerEntityId?: string;
  memoryTier?: MemoryTier;
}

export interface CreateArtifactInput {
  kind: string;
  mimeType: string;
  content: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  autoProcess?: ArtifactAutoProcess;
}

export interface ArtifactMemorySummary {
  id: string;
  content: string;
  embeddingId: string | null;
}

export interface CreateArtifactResponse {
  artifact: Artifact;
  memories?: ArtifactMemorySummary[];
}

export interface DeleteArtifactResponse {
  deleted: boolean;
  memoriesDeleted: number;
}

export interface Relation {
  id: string;
  tenantId: string;
  type: string;
  fromType: RelationNodeType;
  fromId: string;
  toType: RelationNodeType;
  toId: string;
  weight: number | null;
  properties: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRelationInput {
  type: string;
  fromType: RelationNodeType;
  fromId: string;
  toType: RelationNodeType;
  toId: string;
  weight?: number;
  properties?: Record<string, unknown>;
  tags?: string[];
}

export interface ListRelationsOptions {
  fromType?: RelationNodeType;
  fromId?: string;
  toType?: RelationNodeType;
  toId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface TraverseOptions {
  startType: RelationNodeType;
  startId: string;
  relationTypes?: string[];
  depth?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
}

export interface TraverseResult {
  nodes: Array<{
    type: RelationNodeType;
    id: string;
  }>;
  edges: Relation[];
}

export interface ListRelationsResponse {
  relations: Relation[];
  total: number;
  offset: number;
  limit: number;
}

export interface Event {
  id: string;
  tenantId: string;
  actorEntityId: string | null;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
  tags: string[];
}

export interface CreateEventInput {
  actorEntityId?: string;
  eventType: string;
  payload?: Record<string, unknown>;
  tags?: string[];
  timestamp?: string | Date;
}

export interface ListEventsOptions {
  actorEntityId?: string;
  eventType?: string;
  after?: string;
  before?: string;
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface ListEventsResponse {
  events: Event[];
  total: number;
  offset: number;
  limit: number;
}

export interface TimelineEntry {
  date: string;
  count: number;
  types: Record<string, number>;
}

export interface TimelineOptions {
  days?: number;
  actorEntityId?: string;
  eventType?: string;
}

export interface ContextBuildInput {
  agentEntityId?: string;
  userEntityId?: string;
  goal?: string;
  currentInput: string;
  maxTokens?: number;
  strategy?: {
    tiers?: MemoryTier[];
    perTierCaps?: {
      short_term?: number;
      episodic?: number;
      semantic?: number;
    };
    weights?: MemoryQueryWeights;
    tags?: string[];
    topics?: string[];
    includeSystemPrompt?: boolean;
  };
}

export interface ContextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: {
    source?: 'system_prompt' | 'memory' | 'user_profile' | 'agent_profile' | 'current_input';
    memoryIds?: string[];
  };
}

export interface ContextBuildResponse {
  messages: ContextMessage[];
  rawMemories: Array<{
    memory: Memory;
    score: number;
    tier: MemoryTier;
  }>;
  metadata: {
    totalTokensEstimated: number;
    memoriesIncluded: number;
    memoriesQueried: number;
    tiersQueried: MemoryTier[];
  };
}
