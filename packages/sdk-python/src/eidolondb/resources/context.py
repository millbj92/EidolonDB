from __future__ import annotations

from typing import Any

from .._client import EidolonDBClient
from .._types import ContextBuildResponse


class ContextResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def build(self, current_input: str, **kwargs: Any) -> ContextBuildResponse:
        payload = {"currentInput": current_input, **kwargs}
        return self._client.request("POST", "/context/build", body=payload)
