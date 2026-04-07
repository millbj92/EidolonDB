from __future__ import annotations

from typing import Any, List, Optional

from ._client import EidolonDBClient, EidolonDBConfig, EidolonDBError
from . import _types as _types_module
from ._types import *
from ._types import IngestSource, Memory, MemorySearchResult, MemoryTier
from .resources import (
    ArtifactsResource,
    ContextResource,
    EntitiesResource,
    EventsResource,
    FeedbackResource,
    IngestResource,
    LifecycleResource,
    MemoriesResource,
    RelationsResource,
)


class EidolonDB:
    memories: MemoriesResource
    entities: EntitiesResource
    artifacts: ArtifactsResource
    relations: RelationsResource
    events: EventsResource
    context: ContextResource
    lifecycle: LifecycleResource
    feedback: FeedbackResource
    _ingest: IngestResource

    def __init__(self, url: str, tenant: str, timeout: int = 30):
        client = EidolonDBClient(EidolonDBConfig(url=url, tenant=tenant, timeout=timeout))
        self.memories = MemoriesResource(client)
        self.entities = EntitiesResource(client)
        self.artifacts = ArtifactsResource(client)
        self.relations = RelationsResource(client)
        self.events = EventsResource(client)
        self.context = ContextResource(client)
        self.lifecycle = LifecycleResource(client)
        self.feedback = FeedbackResource(client)
        self._ingest = IngestResource(client)

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

    def recall(self, query: str, k: int = 10) -> List[str]:
        results = self.memories.search(query, k=k)
        return [result["memory"]["content"] for result in results]

    def ingest(self, content: str, *, source: IngestSource = "chat", **kwargs: Any) -> dict:
        return self._ingest.run(content, source=source, **kwargs)

    def search(self, query: str, **kwargs: Any) -> List[MemorySearchResult]:
        return self.memories.search(query, **kwargs)


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
    "IngestResource",
]

__all__.extend(
    name
    for name in dir(_types_module)
    if not name.startswith("_") and name not in __all__
)
