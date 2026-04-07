from __future__ import annotations

from typing import Any

from .._client import EidolonDBClient
from .._types import Artifact, CreateArtifactResponse, DeleteArtifactResponse


class ArtifactsResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def create(self, **kwargs: Any) -> CreateArtifactResponse:
        return self._client.request("POST", "/artifacts", body=kwargs)

    def get(self, artifact_id: str) -> Artifact:
        return self._client.request("GET", f"/artifacts/{artifact_id}")

    def delete(self, artifact_id: str) -> DeleteArtifactResponse:
        return self._client.request("DELETE", f"/artifacts/{artifact_id}")
