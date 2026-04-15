from __future__ import annotations

__version__ = "0.1.0"
__all__ = ["EidolonMemory", "EidolonMemoryBuffer"]


def __getattr__(name: str):
    if name == "EidolonMemory":
        from .langchain import EidolonMemory

        return EidolonMemory
    if name == "EidolonMemoryBuffer":
        from .llamaindex import EidolonMemoryBuffer

        return EidolonMemoryBuffer
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
