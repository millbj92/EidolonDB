import json
from unittest.mock import patch

from eidolondb import EidolonDB


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


def test_validate_supported_verdict():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "data": {
                    "verdict": "supported",
                    "confidence": 0.95,
                    "claim": "Auth provider is Clerk",
                    "supporting": [
                        {
                            "memoryId": "11111111-1111-1111-1111-111111111111",
                            "content": "Auth provider is Clerk.",
                            "similarity": 0.93,
                            "tier": "semantic",
                            "createdAt": "2026-04-17T00:00:00.000Z",
                        }
                    ],
                    "contradicting": [],
                    "reasoning": "Exact supporting memory exists.",
                }
            }
        )

        result = db.validate("Auth provider is Clerk", k=3, threshold=0.8)

        assert result["verdict"] == "supported"
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/validate"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8")) == {
            "claim": "Auth provider is Clerk",
            "k": 3,
            "threshold": 0.8,
        }


def test_validate_unverified_verdict():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "data": {
                    "verdict": "unverified",
                    "confidence": 0.28,
                    "claim": "Customer has SOC2 Type II",
                    "supporting": [],
                    "contradicting": [],
                    "reasoning": "No supporting evidence above threshold.",
                }
            }
        )

        result = db.validate("Customer has SOC2 Type II")

        assert result["verdict"] == "unverified"
        assert result["supporting"] == []
        assert result["contradicting"] == []
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/validate"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8")) == {
            "claim": "Customer has SOC2 Type II",
            "k": 5,
            "threshold": 0.7,
        }
