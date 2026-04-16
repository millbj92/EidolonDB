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


def test_conflicts_detect_calls_post_conflicts_detect():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "data": {
                    "scanned": 10,
                    "conflictsFound": 1,
                    "autoResolved": 0,
                    "conflicts": [],
                }
            }
        )

        db.conflicts.detect(auto_resolve=True, strategy="newer-wins", limit=25)

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/conflicts/detect"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8")) == {
            "autoResolve": True,
            "strategy": "newer-wins",
            "limit": 25,
        }


def test_conflicts_resolve_calls_post_conflicts_resolve():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response({"data": {"resolved": True}})

        db.conflicts.resolve(memory_id_a="m1", memory_id_b="m2", strategy="merge")

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/conflicts/resolve"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8")) == {
            "memoryIdA": "m1",
            "memoryIdB": "m2",
            "strategy": "merge",
        }


def test_db_detect_conflicts_convenience_method():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "data": {
                    "scanned": 0,
                    "conflictsFound": 0,
                    "autoResolved": 0,
                    "conflicts": [],
                }
            }
        )

        db.detect_conflicts(auto_resolve=False, strategy="manual", limit=50)

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/conflicts/detect"
        assert json.loads(req.data.decode("utf-8")) == {
            "autoResolve": False,
            "strategy": "manual",
            "limit": 50,
        }


def test_db_resolve_conflict_convenience_method():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response({"data": {"resolved": True}})

        db.resolve_conflict(memory_id_a="m1", memory_id_b="m2", strategy="higher-importance")

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/conflicts/resolve"
        assert json.loads(req.data.decode("utf-8")) == {
            "memoryIdA": "m1",
            "memoryIdB": "m2",
            "strategy": "higher-importance",
        }
