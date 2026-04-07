from __future__ import annotations

from typing import Dict, List

from .._client import EidolonDBClient
from .._types import LifecycleRun, LifecycleRunResponse


class LifecycleResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def run(self, *, dry_run: bool = False, triggered_by: str = "manual") -> LifecycleRunResponse:
        payload = {
            "dryRun": dry_run,
            "triggeredBy": triggered_by,
        }
        return self._client.request("POST", "/lifecycle/run", body=payload)

    def list_runs(self, *, limit: int = 20) -> List[LifecycleRun]:
        params: Dict[str, int] = {"limit": limit}
        response = self._client.request("GET", "/lifecycle/runs", params=params)
        return response.get("runs", []) if isinstance(response, dict) else response
