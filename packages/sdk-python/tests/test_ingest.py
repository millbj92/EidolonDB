import json
from unittest.mock import patch

from eidolondb import EidolonDB


class MockHTTPResponse:
    def __init__(self, body, headers=None):
        self._body = body
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


def test_db_ingest_calls_post_ingest():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "data": {
                    "success": True,
                    "traceId": "trace-1",
                    "summary": {"candidates": 1, "accepted": 1, "rejected": 0},
                    "acceptedMemories": [],
                    "rejectedMemories": [],
                    "warnings": [],
                }
            }
        )

        response = db.ingest("Today we chose FastAPI.")

        assert response["success"] is True
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/ingest"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8"))["content"] == "Today we chose FastAPI."


def test_db_remember_calls_post_memories_with_semantic_tier():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "data": {
                    "id": "m1",
                    "tenantId": "test-tenant",
                    "ownerEntityId": None,
                    "tier": "semantic",
                    "content": "Remember this",
                    "sourceArtifactId": None,
                    "sourceEventId": None,
                    "embeddingId": None,
                    "importanceScore": 0.8,
                    "recencyScore": 1.0,
                    "accessCount": 0,
                    "lastAccessedAt": None,
                    "metadata": {},
                    "tags": [],
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "updatedAt": "2026-01-01T00:00:00.000Z",
                }
            }
        )

        db.remember("Remember this", importance=None)

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/memories"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8")) == {"tier": "semantic", "content": "Remember this"}
