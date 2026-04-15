from __future__ import annotations

from typing import Optional

from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.core.memory import BaseMemory

from eidolondb import EidolonDB


class EidolonMemoryBuffer(BaseMemory):
    """LlamaIndex memory backend powered by EidolonDB."""

    def __init__(self, url: str = "http://localhost:3000", tenant: str = "default", k: int = 5):
        self._client = EidolonDB(url=url, tenant=tenant)
        self._k = k
        self._current_input: Optional[str] = None

    @classmethod
    def from_defaults(
        cls,
        url: str = "http://localhost:3000",
        tenant: str = "default",
        k: int = 5,
    ) -> "EidolonMemoryBuffer":
        return cls(url=url, tenant=tenant, k=k)

    def get(self, input: Optional[str] = None, **kwargs) -> list[ChatMessage]:
        """Return relevant memories as ChatMessages."""
        query = input or self._current_input or ""
        if not query:
            return []

        memories = self._client.recall(query, k=self._k)
        return [ChatMessage(role=MessageRole.SYSTEM, content=memory) for memory in memories]

    def get_all(self) -> list[ChatMessage]:
        return []

    def put(self, message: ChatMessage) -> None:
        """Ingest a message into EidolonDB."""
        if message.content:
            source = (
                "chat"
                if message.role in (MessageRole.USER, MessageRole.ASSISTANT)
                else "system"
            )
            self._client.ingest(str(message.content), source=source)

    def set(self, messages: list[ChatMessage]) -> None:
        for message in messages:
            self.put(message)

    def reset(self) -> None:
        """No-op. EidolonDB manages its own lifecycle."""
        return None
