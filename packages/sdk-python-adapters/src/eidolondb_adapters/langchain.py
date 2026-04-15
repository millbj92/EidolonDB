from __future__ import annotations

from langchain_core.memory import BaseMemory
from langchain_core.messages import HumanMessage

from eidolondb import EidolonDB


class EidolonMemory(BaseMemory):
    """LangChain memory backend powered by EidolonDB."""

    url: str = "http://localhost:3000"
    tenant: str = "default"
    api_key: str = ""
    k: int = 5
    memory_key: str = "history"
    input_key: str = "input"
    output_key: str = "output"
    return_messages: bool = False

    _client: EidolonDB = None

    def model_post_init(self, __context) -> None:
        self._client = EidolonDB(url=self.url, tenant=self.tenant)

    @property
    def memory_variables(self) -> list[str]:
        return [self.memory_key]

    def load_memory_variables(self, inputs: dict) -> dict:
        """Recall relevant memories for the current input."""
        query = inputs.get(self.input_key, "")
        if not query:
            return {self.memory_key: [] if self.return_messages else ""}

        memories = self._client.recall(query, k=self.k)

        if self.return_messages:
            messages = [HumanMessage(content=memory) for memory in memories]
            return {self.memory_key: messages}

        return {self.memory_key: "\n".join(memories)}

    def save_context(self, inputs: dict, outputs: dict) -> None:
        """Ingest the conversation turn into EidolonDB."""
        human = inputs.get(self.input_key, "")
        ai = outputs.get(self.output_key, "")
        if human or ai:
            text = f"Human: {human}\nAI: {ai}" if human and ai else human or ai
            self._client.ingest(text, source="chat")

    def clear(self) -> None:
        """No-op. EidolonDB manages its own lifecycle."""
        return None
