# eidolondb-adapters

LangChain and LlamaIndex memory adapters for EidolonDB.

## Installation

```bash
pip install "eidolondb-adapters[langchain]"
# or
pip install "eidolondb-adapters[llamaindex]"
# or
pip install "eidolondb-adapters[all]"
```

Works with both self-hosted EidolonDB and the EidolonDB Cloud API (`eidolondb.com`).

## LangChain Example

```python
from langchain_core.language_models import FakeListLLM
from langchain.chains import ConversationChain

from eidolondb_adapters import EidolonMemory

memory = EidolonMemory(
    url="http://localhost:3000",
    tenant="my-tenant",
    k=5,
    memory_key="history",
    input_key="input",
    output_key="response",
)

llm = FakeListLLM(responses=["I can help with that."])
chain = ConversationChain(llm=llm, memory=memory)

result = chain.predict(input="We chose PostgreSQL for analytics.")
print(result)
```

## LlamaIndex Example

```python
from llama_index.core.chat_engine import SimpleChatEngine
from llama_index.core.llms import ChatMessage, MessageRole

from eidolondb_adapters import EidolonMemoryBuffer

memory = EidolonMemoryBuffer.from_defaults(
    url="http://localhost:3000",
    tenant="my-tenant",
    k=5,
)

# You can still push messages directly if needed.
memory.put(ChatMessage(role=MessageRole.USER, content="My preferred editor is Neovim."))

chat_engine = SimpleChatEngine.from_defaults(memory=memory)
response = chat_engine.chat("What tools do I prefer?")
print(response)
```

## Configuration

| Parameter | Applies To | Default | Description |
| --- | --- | --- | --- |
| `url` | LangChain, LlamaIndex | `http://localhost:3000` | EidolonDB base URL (local or cloud endpoint). |
| `tenant` | LangChain, LlamaIndex | `default` | Tenant ID used by the EidolonDB SDK. |
| `k` | LangChain, LlamaIndex | `5` | Number of recalled memories to fetch per query. |
| `input_key` | LangChain | `input` | Input key used to read the current user prompt. |
| `output_key` | LangChain | `output` | Output key used to ingest the model response. |
| `memory_key` | LangChain | `history` | Variable name injected into LangChain memory context. |
| `return_messages` | LangChain | `False` | Return `HumanMessage` objects instead of a joined string. |
