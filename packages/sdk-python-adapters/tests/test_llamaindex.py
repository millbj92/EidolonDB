from __future__ import annotations

import importlib
import sys
import types


def _install_llamaindex_stubs(monkeypatch):
    if "llama_index" in sys.modules:
        return

    llama_index = types.ModuleType("llama_index")
    core_mod = types.ModuleType("llama_index.core")
    memory_mod = types.ModuleType("llama_index.core.memory")
    llms_mod = types.ModuleType("llama_index.core.llms")

    class BaseMemory:
        pass

    class MessageRole:
        USER = "user"
        ASSISTANT = "assistant"
        SYSTEM = "system"

    class ChatMessage:
        def __init__(self, role, content):
            self.role = role
            self.content = content

    memory_mod.BaseMemory = BaseMemory
    llms_mod.ChatMessage = ChatMessage
    llms_mod.MessageRole = MessageRole

    monkeypatch.setitem(sys.modules, "llama_index", llama_index)
    monkeypatch.setitem(sys.modules, "llama_index.core", core_mod)
    monkeypatch.setitem(sys.modules, "llama_index.core.memory", memory_mod)
    monkeypatch.setitem(sys.modules, "llama_index.core.llms", llms_mod)


def _load_module(monkeypatch):
    _install_llamaindex_stubs(monkeypatch)
    sys.modules.pop("eidolondb_adapters.llamaindex", None)
    return importlib.import_module("eidolondb_adapters.llamaindex")


def test_get_calls_recall_with_input(monkeypatch, mocker):
    module = _load_module(monkeypatch)
    mock_client = mocker.Mock()
    mock_client.recall.return_value = ["memory 1"]
    mock_db = mocker.Mock(return_value=mock_client)
    monkeypatch.setattr(module, "EidolonDB", mock_db)

    memory = module.EidolonMemoryBuffer(k=7)
    messages = memory.get(input="project status")

    mock_client.recall.assert_called_once_with("project status", k=7)
    assert len(messages) == 1
    assert messages[0].content == "memory 1"


def test_put_calls_ingest_with_message_content(monkeypatch, mocker):
    module = _load_module(monkeypatch)
    mock_client = mocker.Mock()
    mock_db = mocker.Mock(return_value=mock_client)
    monkeypatch.setattr(module, "EidolonDB", mock_db)

    memory = module.EidolonMemoryBuffer()
    message = module.ChatMessage(role=module.MessageRole.USER, content="hello")
    memory.put(message)

    mock_client.ingest.assert_called_once_with("hello", source="chat")


def test_reset_is_noop(monkeypatch, mocker):
    module = _load_module(monkeypatch)
    mock_client = mocker.Mock()
    mock_db = mocker.Mock(return_value=mock_client)
    monkeypatch.setattr(module, "EidolonDB", mock_db)

    memory = module.EidolonMemoryBuffer()
    memory.reset()


def test_from_defaults_creates_instance_with_correct_params(monkeypatch, mocker):
    module = _load_module(monkeypatch)
    mock_client = mocker.Mock()
    mock_db = mocker.Mock(return_value=mock_client)
    monkeypatch.setattr(module, "EidolonDB", mock_db)

    memory = module.EidolonMemoryBuffer.from_defaults(
        url="http://example.com",
        tenant="tenant-a",
        k=9,
    )

    assert isinstance(memory, module.EidolonMemoryBuffer)
    mock_db.assert_called_once_with(url="http://example.com", tenant="tenant-a")
    assert memory._k == 9
