from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from .._client import EidolonDBClient
from .._types import Event, ListEventsResponse, TimelineEntry


class EventsResource:
    def __init__(self, client: EidolonDBClient):
        self._client = client

    def create(self, **kwargs: Any) -> Event:
        payload = dict(kwargs)
        timestamp = payload.get("timestamp")
        if isinstance(timestamp, datetime):
            payload["timestamp"] = timestamp.isoformat()
        return self._client.request("POST", "/events", body=payload)

    def list(
        self,
        *,
        actor_entity_id: Optional[str] = None,
        event_type: Optional[str] = None,
        after: Optional[str] = None,
        before: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        sort_order: Optional[str] = None,
    ) -> List[Event]:
        params: Dict[str, Any] = {
            "actorEntityId": actor_entity_id,
            "eventType": event_type,
            "after": after,
            "before": before,
            "limit": limit,
            "offset": offset,
            "sortOrder": sort_order,
        }
        response: ListEventsResponse = self._client.request("GET", "/events", params=params)
        return response.get("events", [])

    def get(self, event_id: str) -> Event:
        return self._client.request("GET", f"/events/{event_id}")

    def timeline(
        self,
        *,
        days: Optional[int] = None,
        actor_entity_id: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> List[TimelineEntry]:
        params: Dict[str, Any] = {
            "days": days,
            "actorEntityId": actor_entity_id,
            "eventType": event_type,
        }
        return self._client.request("GET", "/events/timeline", params=params)
