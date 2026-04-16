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


def test_grants_create_calls_post_grants():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "data": {
                    "id": "g1",
                    "tenantId": "test-tenant",
                    "ownerEntityId": "owner-1",
                    "granteeEntityId": "grantee-1",
                    "permission": "read",
                    "scopeTier": None,
                    "scopeTag": None,
                    "createdAt": "2026-01-01T00:00:00.000Z",
                }
            }
        )

        db.grants.create("owner-1", "grantee-1")

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/grants"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode("utf-8")) == {
            "ownerEntityId": "owner-1",
            "granteeEntityId": "grantee-1",
            "permission": "read",
            "scopeTier": None,
            "scopeTag": None,
        }


def test_grants_list_calls_get_grants_with_query_params():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response({"data": {"grants": [], "total": 0, "limit": 20, "offset": 0}})

        db.grants.list(owner_entity_id="owner-1", grantee_entity_id="grantee-1", limit=10, offset=5)

        req = mock_urlopen.call_args[0][0]
        assert req.get_method() == "GET"
        assert req.full_url == (
            "http://localhost:3000/grants"
            "?ownerEntityId=owner-1&granteeEntityId=grantee-1&limit=10&offset=5"
        )


def test_grants_get_calls_get_grants_by_id():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response(
            {
                "data": {
                    "id": "g1",
                    "tenantId": "test-tenant",
                    "ownerEntityId": "owner-1",
                    "granteeEntityId": "grantee-1",
                    "permission": "read",
                    "scopeTier": None,
                    "scopeTag": None,
                    "createdAt": "2026-01-01T00:00:00.000Z",
                }
            }
        )

        db.grants.get("g1")

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/grants/g1"
        assert req.get_method() == "GET"


def test_grants_delete_calls_delete_grants_by_id():
    db = EidolonDB(url="http://localhost:3000", tenant="test-tenant")

    with patch("eidolondb._client.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value = _json_response({"data": None})

        db.grants.delete("g1")

        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:3000/grants/g1"
        assert req.get_method() == "DELETE"
