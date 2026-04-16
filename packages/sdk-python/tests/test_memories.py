import io
import json
from unittest.mock import patch
from urllib.error import HTTPError

import pytest

from eidolondb import EidolonDB, EidolonDBError


class MockHTTPResponse:
    def __init__(self, body, status=200, headers=None):
        self._body = body
        self.status = status
        self.headers = headers or {"Content-Type": "application/json"}

    def read(self):
        if isinstance(self._body, bytes):
            return self._body
        return str(self._body).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def _json_response(payload):
    return MockHTTPResponse(json.dumps(payload), headers={"Content-Type": "application/json"})


def test_create_sends_post_memories():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "data": {
                    "id": "m1",
                    "tenantId": "test-tenant",
                    "ownerEntityId": None,
                    "tier": "semantic",
                    "content": "hello",
                    "sourceArtifactId": None,
                    "sourceEventId": None,
                    "embeddingId": None,
                    "importanceScore": 0.9,
                    "recencyScore": 1.0,
                    "accessCount": 0,
                    "lastAccessedAt": None,
                    "metadata": {},
                    "tags": ["a"],
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "updatedAt": "2026-01-01T00:00:00.000Z",
                }
            }
        )

        db.memories.create("semantic", "hello", importanceScore=0.9, tags=["a"])

        assert mock_urlopen.call_count == 1
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/memories"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8")) == {
            "tier": "semantic",
            "content": "hello",
            "importanceScore": 0.9,
            "tags": ["a"],
        }
        assert req.headers["X-tenant-id"] == "test-tenant"


def test_search_sends_post_memories_query():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response({"data": {"results": []}})

        db.memories.search("user prefs", k=10)

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/memories/query"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8")) == {"text": "user prefs", "k": 10}


def test_list_includes_conflict_status_query_param():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response({"data": {"memories": [], "total": 0, "offset": 0, "limit": 20}})

        db.memories.list(conflict_status="flagged", limit=5, offset=2)

        req = mock_urlopen.call_args[0][0]
        assert req.get_method() == "GET"
        assert req.full_url == (
            "http://localhost:3000/memories"
            "?limit=5&offset=2&sortBy=createdAt&sortOrder=desc&conflictStatus=flagged"
        )


def test_raises_eidolondb_error_on_non_2xx():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    body = json.dumps({"error": {"message": "boom"}}).encode("utf-8")
    http_error = HTTPError(
        url="http://localhost:3000/memories/missing",
        code=400,
        msg="Bad Request",
        hdrs={"Content-Type": "application/json"},
        fp=io.BytesIO(body),
    )

    with patch("eidolondb._client.request.urlopen", side_effect=http_error):
        with pytest.raises(EidolonDBError) as exc:
            db.memories.get("missing")

    assert exc.value.status == 400
    assert exc.value.message == "boom"
