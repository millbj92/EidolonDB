from __future__ import annotations

import importlib
import sys
import types


def _install_langchain_stubs(monkeypatch):
    if "langchain_core" in sys.modules:
        return

    langchain_core = types.ModuleType("langchain_core")
    memory_mod = types.ModuleType("langchain_core.memory")
    messages_mod = types.ModuleType("langchain_core.messages")

    class BaseMemory:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)
            if hasattr(self, "model_post_init"):
                self.model_post_init(None)

    class BaseMessage:
        def __init__(self, content):
            self.content = content

    class HumanMessage(BaseMessage):
        pass

    class AIMessage(BaseMessage):
        pass

    memory_mod.BaseMemory = BaseMemory
    messages_mod.BaseMessage = BaseMessage
    messages_mod.HumanMessage = HumanMessage
    messages_mod.AIMessage = AIMessage

    monkeypatch.setitem(sys.modules, "langchain_core", langchain_core)
    monkeypatch.setitem(sys.modules, "langchain_core.memory", memory_mod)
    monkeypatch.setitem(sys.modules, "langchain_core.messages", messages_mod)


def _load_module(monkeypatch):
    _install_langchain_stubs(monkeypatch)
    sys.modules.pop("eidolondb_adapters.langchain", None)
    return importlib.import_module("eidolondb_adapters.langchain")


def test_load_memory_variables_calls_recall_with_input(monkeypatch, mocker):
    module = _load_module(monkeypatch)
    mock_client = mocker.Mock()
    mock_client.recall.return_value = ["m1", "m2"]
    mock_db = mocker.Mock(return_value=mock_client)
    monkeypatch.setattr(module, "EidolonDB", mock_db)

    memory = module.EidolonMemory(k=3)
    result = memory.load_memory_variables({"input": "what did we decide?"})

    mock_client.recall.assert_called_once_with("what did we decide?", k=3)
    assert result == {"history": "m1\nm2"}


def test_save_context_calls_ingest_with_combined_text(monkeypatch, mocker):
    module = _load_module(monkeypatch)
    mock_client = mocker.Mock()
    mock_db = mocker.Mock(return_value=mock_client)
    monkeypatch.setattr(module, "EidolonDB", mock_db)

    memory = module.EidolonMemory()
    memory.save_context({"input": "hello"}, {"output": "world"})

    mock_client.ingest.assert_called_once_with("Human: hello\nAI: world", source="chat")


def test_return_messages_true_returns_human_messages(monkeypatch, mocker):
    module = _load_module(monkeypatch)
    mock_client = mocker.Mock()
    mock_client.recall.return_value = ["alpha", "beta"]
    mock_db = mocker.Mock(return_value=mock_client)
    monkeypatch.setattr(module, "EidolonDB", mock_db)

    memory = module.EidolonMemory(return_messages=True)
    result = memory.load_memory_variables({"input": "query"})

    history = result["history"]
    assert len(history) == 2
    assert all(isinstance(message, module.HumanMessage) for message in history)
    assert [message.content for message in history] == ["alpha", "beta"]


def test_empty_input_returns_empty_string(monkeypatch, mocker):
    module = _load_module(monkeypatch)
    mock_client = mocker.Mock()
    mock_db = mocker.Mock(return_value=mock_client)
    monkeypatch.setattr(module, "EidolonDB", mock_db)

    memory = module.EidolonMemory()
    result = memory.load_memory_variables({"input": ""})

    assert result == {"history": ""}
    mock_client.recall.assert_not_called()
