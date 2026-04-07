from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib import error, parse, request


@dataclass(frozen=True)
class EidolonDBConfig:
    url: str
    tenant: str
    timeout: int = 30


class EidolonDBError(Exception):
    def __init__(self, status: int, message: str, body: Any):
        super().__init__(message)
        self.status = status
        self.message = message
        self.body = body


class EidolonDBClient:
    def __init__(self, config: EidolonDBConfig):
        self._base_url = config.url.rstrip("/")
        self._tenant = config.tenant
        self._timeout = config.timeout

    def request(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Any:
        url = f"{self._base_url}{path}"
        if params:
            query = self._encode_params(params)
            if query:
                url = f"{url}?{query}"

        payload: Optional[bytes] = None
        if body is not None:
            payload = json.dumps(body).encode("utf-8")

        req = request.Request(
            url=url,
            data=payload,
            method=method.upper(),
            headers={
                "Content-Type": "application/json",
                "x-tenant-id": self._tenant,
            },
        )

        try:
            with request.urlopen(req, timeout=self._timeout) as response:
                response_body = self._read_response(response)
                return self._unwrap_data(response_body)
        except error.HTTPError as exc:
            parsed = self._parse_error_body(exc)
            message = self._extract_error_message(parsed, exc)
            raise EidolonDBError(exc.code, message, parsed)
        except error.URLError as exc:
            message = str(getattr(exc, "reason", exc))
            raise EidolonDBError(0, message, None)

    def _encode_params(self, params: Dict[str, Any]) -> str:
        items = []
        for key, raw in params.items():
            if raw is None:
                continue
            if isinstance(raw, (list, tuple)):
                for value in raw:
                    if value is not None:
                        items.append((key, str(value)))
                continue
            if isinstance(raw, dict):
                items.append((key, json.dumps(raw)))
                continue
            items.append((key, str(raw)))

        return parse.urlencode(items, doseq=True)

    def _read_response(self, response: Any) -> Any:
        raw = response.read()
        if not raw:
            return None

        text = raw.decode("utf-8")
        content_type = (response.headers.get("Content-Type") or "").lower()
        if "application/json" in content_type:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
        return text

    def _parse_error_body(self, exc: error.HTTPError) -> Any:
        raw = exc.read()
        if not raw:
            return None

        text = raw.decode("utf-8")
        content_type = (exc.headers.get("Content-Type") or "").lower() if exc.headers else ""
        if "application/json" in content_type:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
        return text

    def _extract_error_message(self, body: Any, exc: error.HTTPError) -> str:
        if isinstance(body, dict):
            error_obj = body.get("error")
            if isinstance(error_obj, dict):
                msg = error_obj.get("message")
                if isinstance(msg, str) and msg:
                    return msg
            msg = body.get("message")
            if isinstance(msg, str) and msg:
                return msg
        return exc.reason or f"Request failed with status {exc.code}"

    def _unwrap_data(self, body: Any) -> Any:
        if isinstance(body, dict) and "data" in body:
            return body["data"]
        return body
