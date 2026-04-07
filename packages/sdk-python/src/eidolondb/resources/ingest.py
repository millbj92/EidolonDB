from __future__ import annotations

from typing import Any

from .._client import EidolonDBClient
from .._types import IngestResponse, IngestSource


class IngestResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def run(
        self,
        content: str,
        *,
        source: IngestSource = "chat",
        auto_store: bool = True,
        debug: bool = False,
        **kwargs: Any,
    ) -> IngestResponse:
        payload = {
            "content": content,
            "source": source,
            "autoStore": auto_store,
            "debug": debug,
            **kwargs,
        }
        return self._client.request("POST", "/ingest", body=payload)
