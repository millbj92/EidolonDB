from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict

MemoryTier = Literal["short_term", "episodic", "semantic"]
DedupStatus = Literal["new", "duplicate", "near_duplicate", "conflict", "needs_review"]
IngestSource = Literal["chat", "note", "event", "document", "system"]
RelationNodeType = Literal["entity", "artifact", "memory"]
LifecycleActionType = Literal["expired", "promoted", "distilled", "archived", "unchanged", "error"]
ContextMessageRole = Literal["system", "user", "assistant"]


class Memory(TypedDict):
    id: str
    tenantId: str
    ownerEntityId: Optional[str]
    tier: MemoryTier
    content: str
    sourceArtifactId: Optional[str]
    sourceEventId: Optional[str]
    embeddingId: Optional[str]
    importanceScore: Optional[float]
    recencyScore: Optional[float]
    accessCount: Optional[int]
    lastAccessedAt: Optional[str]
    tags: List[str]
    metadata: Dict[str, Any]
    createdAt: str
    updatedAt: str


class CreateMemoryInput(TypedDict, total=False):
    ownerEntityId: str
    tier: MemoryTier
    content: str
    sourceArtifactId: str
    sourceEventId: str
    importanceScore: float
    metadata: Dict[str, Any]
    tags: List[str]


class UpdateMemoryInput(TypedDict, total=False):
    content: str
    tier: MemoryTier
    importanceScore: float
    tags: List[str]
    metadata: Dict[str, Any]


class MemoryQueryWeights(TypedDict, total=False):
    semantic: float
    recency: float
    importance: float


class SearchMemoriesOptions(TypedDict, total=False):
    k: int
    ownerEntityId: str
    tiers: List[MemoryTier]
    tags: List[str]
    sourceArtifactId: str
    createdAfter: str
    createdBefore: str
    weights: MemoryQueryWeights
    minScore: float


class ListMemoriesOptions(TypedDict, total=False):
    offset: int
    limit: int
    tier: MemoryTier
    tag: str
    ownerEntityId: str
    sortBy: Literal["createdAt", "importanceScore", "accessCount"]
    sortOrder: Literal["asc", "desc"]


class MemorySearchReasons(TypedDict, total=False):
    semantic: float
    recency: float
    importance: float


class MemorySearchResult(TypedDict):
    memory: Memory
    score: float
    reasons: MemorySearchReasons


class ListMemoriesResponse(TypedDict):
    memories: List[Memory]
    total: int
    offset: int
    limit: int


class MemoryStatsByTier(TypedDict):
    episodic: int
    semantic: int
    short_term: int


class MemoryStatsByDay(TypedDict):
    date: str
    count: int


class MemoryStatsResponse(TypedDict):
    total: int
    byTier: MemoryStatsByTier
    byDay: List[MemoryStatsByDay]


class CandidateMemory(TypedDict):
    content: str
    memoryType: MemoryTier
    importance: float
    confidence: float
    tags: List[str]
    sourceSpan: str
    rationale: str


class AcceptedMemory(CandidateMemory, total=False):
    memoryId: str
    dedupStatus: DedupStatus


class RejectedMemory(CandidateMemory):
    dedupStatus: DedupStatus
    reason: str


class IngestRequest(TypedDict, total=False):
    content: str
    source: IngestSource
    actorId: str
    sessionId: str
    ownerEntityId: str
    autoStore: bool
    debug: bool
    metadata: Dict[str, Any]


class IngestSummary(TypedDict):
    candidates: int
    accepted: int
    rejected: int


class IngestDebug(TypedDict):
    normalizedInput: str
    extractorVersion: str
    promptVersion: str
    durationMs: int


class IngestResponse(TypedDict, total=False):
    success: bool
    traceId: str
    summary: IngestSummary
    acceptedMemories: List[AcceptedMemory]
    rejectedMemories: List[RejectedMemory]
    warnings: List[str]
    debug: IngestDebug


class LifecycleRunRequest(TypedDict, total=False):
    dryRun: bool
    triggeredBy: str


class LifecycleAction(TypedDict, total=False):
    memoryId: str
    action: LifecycleActionType
    fromTier: MemoryTier
    toTier: MemoryTier
    reason: str
    newMemoryId: str


class LifecycleSummary(TypedDict):
    expired: int
    promoted: int
    distilled: int
    archived: int
    unchanged: int
    durationMs: int


class LifecycleRunResponse(TypedDict):
    success: bool
    runId: str
    dryRun: bool
    summary: LifecycleSummary
    details: List[LifecycleAction]
    errors: List[str]


class LifecycleRun(TypedDict):
    id: str
    tenantId: str
    triggeredBy: str
    durationMs: Optional[int]
    expired: int
    promoted: int
    distilled: int
    archived: int
    unchanged: int
    errors: List[str]
    completedAt: Optional[str]
    createdAt: str


class Entity(TypedDict):
    id: str
    tenantId: str
    type: str
    name: str
    properties: Dict[str, Any]
    primaryArtifactId: Optional[str]
    tags: List[str]
    createdAt: str
    updatedAt: str


class CreateEntityInput(TypedDict, total=False):
    type: str
    name: str
    properties: Dict[str, Any]
    primaryArtifactId: str
    tags: List[str]


class UpdateEntityInput(TypedDict, total=False):
    type: str
    name: str
    properties: Dict[str, Any]
    primaryArtifactId: Optional[str]
    tags: List[str]


class ListEntitiesOptions(TypedDict, total=False):
    type: str
    tag: str
    limit: int
    offset: int


class Artifact(TypedDict):
    id: str
    tenantId: str
    kind: str
    mimeType: str
    content: str
    metadata: Dict[str, Any]
    tags: List[str]
    createdAt: str
    updatedAt: str


class ArtifactAutoProcess(TypedDict, total=False):
    chunkSize: int
    chunkOverlap: int
    generateEmbeddings: bool
    ownerEntityId: str
    memoryTier: MemoryTier


class CreateArtifactInput(TypedDict, total=False):
    kind: str
    mimeType: str
    content: str
    metadata: Dict[str, Any]
    tags: List[str]
    autoProcess: ArtifactAutoProcess


class ArtifactMemorySummary(TypedDict):
    id: str
    content: str
    embeddingId: Optional[str]


class CreateArtifactResponse(TypedDict, total=False):
    artifact: Artifact
    memories: List[ArtifactMemorySummary]


class DeleteArtifactResponse(TypedDict):
    deleted: bool
    memoriesDeleted: int


class Relation(TypedDict):
    id: str
    tenantId: str
    type: str
    fromType: RelationNodeType
    fromId: str
    toType: RelationNodeType
    toId: str
    weight: Optional[float]
    properties: Dict[str, Any]
    tags: List[str]
    createdAt: str
    updatedAt: str


class CreateRelationInput(TypedDict, total=False):
    type: str
    fromType: RelationNodeType
    fromId: str
    toType: RelationNodeType
    toId: str
    weight: float
    properties: Dict[str, Any]
    tags: List[str]


class ListRelationsOptions(TypedDict, total=False):
    fromType: RelationNodeType
    fromId: str
    toType: RelationNodeType
    toId: str
    type: str
    limit: int
    offset: int


class TraverseOptions(TypedDict, total=False):
    startType: RelationNodeType
    startId: str
    relationTypes: List[str]
    depth: int
    direction: Literal["outgoing", "incoming", "both"]


class TraverseNode(TypedDict):
    type: RelationNodeType
    id: str


class TraverseResult(TypedDict):
    nodes: List[TraverseNode]
    edges: List[Relation]


class ListRelationsResponse(TypedDict):
    relations: List[Relation]
    total: int
    offset: int
    limit: int


class Event(TypedDict):
    id: str
    tenantId: str
    actorEntityId: Optional[str]
    eventType: str
    timestamp: str
    payload: Dict[str, Any]
    tags: List[str]


class CreateEventInput(TypedDict, total=False):
    actorEntityId: str
    eventType: str
    payload: Dict[str, Any]
    tags: List[str]
    timestamp: str


class ListEventsOptions(TypedDict, total=False):
    actorEntityId: str
    eventType: str
    after: str
    before: str
    limit: int
    offset: int
    sortOrder: Literal["asc", "desc"]


class ListEventsResponse(TypedDict):
    events: List[Event]
    total: int
    offset: int
    limit: int


class TimelineEntry(TypedDict):
    date: str
    count: int
    types: Dict[str, int]


class TimelineOptions(TypedDict, total=False):
    days: int
    actorEntityId: str
    eventType: str


class PerTierCaps(TypedDict, total=False):
    short_term: int
    episodic: int
    semantic: int


class ContextStrategy(TypedDict, total=False):
    tiers: List[MemoryTier]
    perTierCaps: PerTierCaps
    weights: MemoryQueryWeights
    tags: List[str]
    topics: List[str]
    includeSystemPrompt: bool


class ContextBuildInput(TypedDict, total=False):
    agentEntityId: str
    userEntityId: str
    goal: str
    currentInput: str
    maxTokens: int
    strategy: ContextStrategy


class ContextMessageMetadata(TypedDict, total=False):
    source: Literal["system_prompt", "memory", "user_profile", "agent_profile", "current_input"]
    memoryIds: List[str]


class ContextMessage(TypedDict, total=False):
    role: ContextMessageRole
    content: str
    metadata: ContextMessageMetadata


class RawContextMemory(TypedDict):
    memory: Memory
    score: float
    tier: MemoryTier


class ContextMetadata(TypedDict):
    totalTokensEstimated: int
    memoriesIncluded: int
    memoriesQueried: int
    tiersQueried: List[MemoryTier]


class ContextBuildResponse(TypedDict):
    messages: List[ContextMessage]
    rawMemories: List[RawContextMemory]
    metadata: ContextMetadata


class RetrievalStatsResponse(TypedDict):
    total: int
    positive: int
    negative: int
    neutral: int


class MarkUsedResponse(TypedDict, total=False):
    success: bool
    memoryId: str
    retrievalEventId: str
