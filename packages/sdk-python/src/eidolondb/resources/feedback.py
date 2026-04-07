from __future__ import annotations

from typing import Any, Dict, Optional

from .._client import EidolonDBClient
from .._types import MarkUsedResponse, RetrievalStatsResponse


class FeedbackResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def mark_used(
        self,
        memory_id: str,
        *,
        query: Optional[str] = None,
        retrieval_score: Optional[float] = None,
        relevance: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MarkUsedResponse:
        payload = {
            "memoryId": memory_id,
            "query": query,
            "retrievalScore": retrieval_score,
            "relevance": relevance,
            "metadata": metadata,
        }
        return self._client.request("POST", "/feedback/mark-used", body=payload)

    def retrieval_stats(self) -> RetrievalStatsResponse:
        return self._client.request("GET", "/feedback/retrieval/stats")
