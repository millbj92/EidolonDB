from __future__ import annotations

from typing import Any, Dict, Optional

from .._client import EidolonDBClient
from .._types import Grant, GrantPermission


class GrantsResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def create(
        self,
        owner_entity_id: str,
        grantee_entity_id: Optional[str] = None,
        permission: GrantPermission = "read",
        scope_tier: Optional[str] = None,
        scope_tag: Optional[str] = None,
    ) -> Grant:
        payload: Dict[str, Any] = {
            "ownerEntityId": owner_entity_id,
            "granteeEntityId": grantee_entity_id,
            "permission": permission,
            "scopeTier": scope_tier,
            "scopeTag": scope_tag,
        }
        return self._client.request("POST", "/grants", body=payload)

    def list(
        self,
        owner_entity_id: Optional[str] = None,
        grantee_entity_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "ownerEntityId": owner_entity_id,
            "granteeEntityId": grantee_entity_id,
            "limit": limit,
            "offset": offset,
        }
        return self._client.request("GET", "/grants", params=params)

    def get(self, id: str) -> Grant:
        return self._client.request("GET", f"/grants/{id}")

    def delete(self, id: str) -> None:
        self._client.request("DELETE", f"/grants/{id}")
