from __future__ import annotations

from typing import Any, List, Optional

from ._client import EidolonDBClient, EidolonDBConfig, EidolonDBError
from . import _types as _types_module
from ._types import *
from ._types import ConflictDetectResult, ConflictResolutionStrategy, IngestSource, Memory, MemorySearchResult, MemoryTier, TemporalFilter
from .resources import (
    ArtifactsResource,
    ConflictsResource,
    ContextResource,
    EntitiesResource,
    EventsResource,
    FeedbackResource,
    GrantsResource,
    IngestResource,
    LifecycleResource,
    MemoriesResource,
    RelationsResource,
)


class EidolonDB:
    _client: EidolonDBClient
    memories: MemoriesResource
    entities: EntitiesResource
    artifacts: ArtifactsResource
    relations: RelationsResource
    events: EventsResource
    context: ContextResource
    lifecycle: LifecycleResource
    feedback: FeedbackResource
    grants: GrantsResource
    conflicts: ConflictsResource
    _ingest: IngestResource

    def __init__(self, url: str, tenant: str, timeout: int = 30):
        self._client = EidolonDBClient(EidolonDBConfig(url=url, tenant=tenant, timeout=timeout))
        self.memories = MemoriesResource(self._client)
        self.entities = EntitiesResource(self._client)
        self.artifacts = ArtifactsResource(self._client)
        self.relations = RelationsResource(self._client)
        self.events = EventsResource(self._client)
        self.context = ContextResource(self._client)
        self.lifecycle = LifecycleResource(self._client)
        self.feedback = FeedbackResource(self._client)
        self.grants = GrantsResource(self._client)
        self.conflicts = ConflictsResource(self._client)
        self._ingest = IngestResource(self._client)

    def remember(
        self,
        content: str,
        *,
        importance: float = 0.8,
        tags: Optional[List[str]] = None,
        tier: MemoryTier = "semantic",
    ) -> Memory:
        kwargs: Any = {}
        if importance is not None:
            kwargs["importanceScore"] = importance
        if tags is not None:
            kwargs["tags"] = tags
        return self.memories.create(tier=tier, content=content, **kwargs)

    def recall(self, query: str, k: int = 10, session_number: Optional[int] = None) -> List[str]:
        """
        Semantic recall returning plain memory contents.

        Args:
            query: Semantic search query
            k: Number of results (default 10)
            session_number: If provided, restrict to a specific session.
                Positive int = absolute session number (e.g. 3 = session 3).
                Negative int = relative offset (e.g. -1 = last session, -2 = two sessions ago).
        """
        kwargs: Any = {"k": k}

        if session_number is not None:
            temporal: TemporalFilter
            if session_number < 0:
                temporal = {"mode": "session-relative", "sessionOffset": session_number}
            else:
                temporal = {"mode": "session-relative", "sessionNumber": session_number}
            kwargs["temporal"] = temporal

        results = self.memories.search(query, **kwargs)
        return [result["memory"]["content"] for result in results]

    def ingest(self, content: str, *, source: IngestSource = "chat", **kwargs: Any) -> dict:
        return self._ingest.run(content, source=source, **kwargs)

    def search(self, query: str, **kwargs: Any) -> List[MemorySearchResult]:
        return self.memories.search(query, **kwargs)

    def validate(
        self,
        claim: str,
        *,
        agent_entity_id: Optional[str] = None,
        k: int = 5,
        threshold: float = 0.7,
        tier: Optional[str] = None,
    ) -> dict:
        payload: dict[str, Any] = {
            "claim": claim,
            "k": k,
            "threshold": threshold,
        }
        if agent_entity_id is not None:
            payload["agentEntityId"] = agent_entity_id
        if tier is not None:
            payload["tier"] = tier

        return self._client.request("POST", "/validate", body=payload)

    def detect_conflicts(
        self,
        auto_resolve: bool = False,
        strategy: ConflictResolutionStrategy = "newer-wins",
        limit: int = 50,
    ) -> ConflictDetectResult:
        return self.conflicts.detect(auto_resolve=auto_resolve, strategy=strategy, limit=limit)

    def resolve_conflict(
        self,
        memory_id_a: str,
        memory_id_b: str,
        strategy: ConflictResolutionStrategy,
    ) -> dict:
        return self.conflicts.resolve(memory_id_a=memory_id_a, memory_id_b=memory_id_b, strategy=strategy)


__all__ = [
    "EidolonDB",
    "EidolonDBClient",
    "EidolonDBConfig",
    "EidolonDBError",
    "MemoriesResource",
    "EntitiesResource",
    "ArtifactsResource",
    "RelationsResource",
    "EventsResource",
    "ContextResource",
    "LifecycleResource",
    "FeedbackResource",
    "GrantsResource",
    "ConflictsResource",
    "IngestResource",
]

__all__.extend(
    name
    for name in dir(_types_module)
    if not name.startswith("_") and name not in __all__
)
