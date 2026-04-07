from __future__ import annotations

from typing import Any, Dict, List, Optional

from .._client import EidolonDBClient
from .._types import Entity


class EntitiesResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def create(self, **kwargs: Any) -> Entity:
        return self._client.request("POST", "/entities", body=kwargs)

    def get(self, entity_id: str) -> Entity:
        return self._client.request("GET", f"/entities/{entity_id}")

    def list(
        self,
        *,
        type: Optional[str] = None,
        tag: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Entity]:
        params: Dict[str, Any] = {
            "type": type,
            "tag": tag,
            "limit": limit,
            "offset": offset,
        }
        response = self._client.request("GET", "/entities", params=params)
        return response.get("entities", []) if isinstance(response, dict) else response

    def update(self, entity_id: str, **kwargs: Any) -> Entity:
        return self._client.request("PATCH", f"/entities/{entity_id}", body=kwargs)

    def delete(self, entity_id: str) -> None:
        self._client.request("DELETE", f"/entities/{entity_id}")
