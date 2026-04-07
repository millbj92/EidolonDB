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


def test_db_lifecycle_run_calls_post_lifecycle_run():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "success": True,
                "runId": "run-1",
                "dryRun": False,
                "summary": {"expired": 0, "promoted": 0, "distilled": 0, "archived": 0, "unchanged": 1, "durationMs": 12},
                "details": [],
                "errors": [],
            }
        )

        response = db.lifecycle.run()

        assert response["success"] is True
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/lifecycle/run"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8")) == {"dryRun": False, "triggeredBy": "manual"}


def test_dry_run_true_passes_dry_run_in_body():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "success": True,
                "runId": "run-2",
                "dryRun": True,
                "summary": {"expired": 0, "promoted": 0, "distilled": 0, "archived": 0, "unchanged": 1, "durationMs": 10},
                "details": [],
                "errors": [],
            }
        )

        db.lifecycle.run(dry_run=True)

        req = mock_urlopen.call_args[0][0]
        assert json.loads(req.data.decode("utf-8"))["dryRun"] is True
