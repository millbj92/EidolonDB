from __future__ import annotations

from typing import Any, Dict, List, Optional

from .._client import EidolonDBClient
from .._types import Relation, RelationNodeType, TraverseResult


class RelationsResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def create(self, **kwargs: Any) -> Relation:
        return self._client.request("POST", "/relations", body=kwargs)

    def list(
        self,
        *,
        from_type: Optional[RelationNodeType] = None,
        from_id: Optional[str] = None,
        to_type: Optional[RelationNodeType] = None,
        to_id: Optional[str] = None,
        type: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Relation]:
        params: Dict[str, Any] = {
            "fromType": from_type,
            "fromId": from_id,
            "toType": to_type,
            "toId": to_id,
            "type": type,
            "limit": limit,
            "offset": offset,
        }
        response = self._client.request("GET", "/relations", params=params)
        return response.get("relations", []) if isinstance(response, dict) else response

    def get(self, relation_id: str) -> Relation:
        return self._client.request("GET", f"/relations/{relation_id}")

    def delete(self, relation_id: str) -> None:
        self._client.request("DELETE", f"/relations/{relation_id}")

    def traverse(
        self,
        *,
        start_type: RelationNodeType,
        start_id: str,
        relation_types: Optional[List[str]] = None,
        depth: Optional[int] = None,
        direction: str = "both",
    ) -> TraverseResult:
        params: Dict[str, Any] = {
            "startType": start_type,
            "startId": start_id,
            "relationTypes": ",".join(relation_types) if relation_types else None,
            "depth": depth,
            "direction": direction,
        }
        return self._client.request("GET", "/relations/traverse", params=params)
