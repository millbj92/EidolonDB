from __future__ import annotations

from typing import Any, Dict

from .._client import EidolonDBClient
from .._types import ConflictDetectResult, ConflictResolutionStrategy


class ConflictsResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def detect(
        self,
        auto_resolve: bool = False,
        strategy: ConflictResolutionStrategy = "newer-wins",
        limit: int = 50,
    ) -> ConflictDetectResult:
        payload = {
            "autoResolve": auto_resolve,
            "strategy": strategy,
            "limit": limit,
        }
        return self._client.request("POST", "/conflicts/detect", body=payload)

    def resolve(
        self,
        memory_id_a: str,
        memory_id_b: str,
        strategy: ConflictResolutionStrategy,
    ) -> Dict[str, Any]:
        payload = {
            "memoryIdA": memory_id_a,
            "memoryIdB": memory_id_b,
            "strategy": strategy,
        }
        return self._client.request("POST", "/conflicts/resolve", body=payload)
