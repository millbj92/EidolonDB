from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock

import pytest


@pytest.fixture
def mocker():
    """Lightweight fallback for environments without pytest-mock."""
    return SimpleNamespace(Mock=Mock)
