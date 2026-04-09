from __future__ import annotations

from typing import Any, Dict, List, Optional

from .._client import EidolonDBClient
from .._types import (
    CreateMemoryInput,
    ListMemoriesResponse,
    Memory,
    MemorySearchResult,
    MemoryStatsResponse,
    MemoryTier,
    SearchMemoriesOptions,
    TemporalFilter,
    UpdateMemoryInput,
)


class MemoriesResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def create(self, tier: MemoryTier, content: str, **kwargs: Any) -> Memory:
        payload: CreateMemoryInput = {
            "tier": tier,
            "content": content,
            **kwargs,
        }
        return self._client.request("POST", "/memories", body=payload)

    def get(self, memory_id: str) -> Memory:
        return self._client.request("GET", f"/memories/{memory_id}")

    def list(
        self,
        *,
        tier: Optional[MemoryTier] = None,
        tag: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = "createdAt",
        sort_order: str = "desc",
        owner_entity_id: Optional[str] = None,
    ) -> ListMemoriesResponse:
        params: Dict[str, Any] = {
            "tier": tier,
            "tag": tag,
            "limit": limit,
            "offset": offset,
            "sortBy": sort_by,
            "sortOrder": sort_order,
            "ownerEntityId": owner_entity_id,
        }
        return self._client.request("GET", "/memories", params=params)

    def update(self, memory_id: str, **kwargs: Any) -> Memory:
        payload: UpdateMemoryInput = {**kwargs}
        return self._client.request("PATCH", f"/memories/{memory_id}", body=payload)

    def delete(self, memory_id: str) -> None:
        self._client.request("DELETE", f"/memories/{memory_id}")

    def search(
        self,
        text: str,
        *,
        k: int = 10,
        tiers: Optional[List[MemoryTier]] = None,
        tags: Optional[List[str]] = None,
        min_score: Optional[float] = None,
        temporal: Optional[TemporalFilter] = None,
        **kwargs: Any,
    ) -> List[MemorySearchResult]:
        options: SearchMemoriesOptions = {
            "k": k,
            "tiers": tiers,
            "tags": tags,
            "minScore": min_score,
            **kwargs,
        }
        if temporal is not None:
            options["temporal"] = temporal
        payload: Dict[str, Any] = {"text": text}
        payload.update({k: v for k, v in options.items() if v is not None})
        response = self._client.request("POST", "/memories/query", body=payload)
        return response.get("results", [])

    def record_access(self, memory_id: str) -> Memory:
        return self._client.request("POST", f"/memories/{memory_id}/access", body={})

    def stats(self) -> MemoryStatsResponse:
        return self._client.request("GET", "/memories/stats")
