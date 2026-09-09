"""Таск 04 (R04i, история 8): SSE по одноразовому ticket вместо токена в URL.

Шов — публичная HTTP-граница: выпуск, использование, повтор и лог.
Бесконечный SSE-стрим нельзя прочитать через TestClient (ограничение
тестового транспорта: BaseHTTPMiddleware рвёт соединение до первого чанка),
поэтому использование/повтор идут через живой uvicorn на эфемерном порту —
тем же HTTP, что видит прод. Остальное — мгновенные ответы — через обычный
тестовый клиент.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import time
import uuid
from collections.abc import Iterator
from http.client import HTTPConnection
from pathlib import Path
from urllib.parse import quote, urlsplit

import pytest
from fastapi.testclient import TestClient

from tests.support import PASSWORD, register_test_user

BACKEND_ROOT = Path(__file__).resolve().parent.parent
LIVE_PORT = 8123


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient) -> str:
    data = register_test_user(
        client, email=_email("sse"), full_name="SSE", role_slug="gk_customer"
    )
    return str(data["access_token"])


def _issue(client: TestClient, token: str):
    return client.post("/api/v1/notifications/sse-ticket", headers=_auth(token))


@pytest.fixture(scope="module")
def live_base() -> Iterator[str]:
    """Живой uvicorn на тестовой БД — читать бесконечный SSE по-настоящему."""
    uvicorn = BACKEND_ROOT / ".venv" / "bin" / "uvicorn"
    assert uvicorn.exists()
    env = {
        **os.environ,
        "POSTGRES_DB": "technozrelost_test",
        "POSTGRES_REPLICA_HOST": "",
        "LLM_API_KEY": "",
        "APP_ENV": "test",
    }
    proc = subprocess.Popen(
        [str(uvicorn), "app.main:app", "--host", "127.0.0.1", "--port", str(LIVE_PORT)],
        cwd=str(BACKEND_ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(200):
            try:
                socket.create_connection(("127.0.0.1", LIVE_PORT), timeout=0.5).close()
                break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError("live uvicorn did not boot")
        yield f"http://127.0.0.1:{LIVE_PORT}"
    finally:
        proc.terminate()
        proc.wait(timeout=15)


def _live_request(
    base: str, method: str, path: str, *, token: str | None = None, body: dict | None = None
) -> tuple[int, bytes]:
    parts = urlsplit(base)
    assert parts.hostname is not None and parts.port is not None
    conn = HTTPConnection(parts.hostname, parts.port, timeout=10)
    try:
        headers: dict[str, str] = {}
        data: str | None = None
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        if body is not None:
            data = json.dumps(body)
            headers["Content-Type"] = "application/json"
        conn.request(method, path, body=data, headers=headers)
        resp = conn.getresponse()
        return resp.status, resp.read()
    finally:
        conn.close()


def _live_register(base: str) -> str:
    status, payload = _live_request(
        base,
        "POST",
        "/api/v1/auth/register",
        body={
            "email": _email("sselive"),
            "password": PASSWORD,
            "full_name": "SSE live",
            "organization": None,
            "role_slug": "gk_customer",
        },
    )
    assert status == 201, payload[:200]
    return str(json.loads(payload)["access_token"])


def _live_issue(base: str, token: str) -> tuple[int, bytes]:
    return _live_request(
        base, "POST", "/api/v1/notifications/sse-ticket", token=token
    )


def _live_stream_head(base: str, ticket: str) -> tuple[int, bytes]:
    """Открывает стрим и читает голову события (chunked-фрейминг пропускаем)."""
    parts = urlsplit(base)
    assert parts.hostname is not None and parts.port is not None
    conn = HTTPConnection(parts.hostname, parts.port, timeout=10)
    try:
        conn.request("GET", f"/api/v1/notifications/stream?ticket={quote(ticket)}")
        resp = conn.getresponse()
        assert resp.status == 200, resp.status
        ctype = resp.getheader("Content-Type", "")
        assert "text/event-stream" in ctype, ctype
        head = b"".join(resp.fp.readline(4096) for _ in range(4))
        return resp.status, head
    finally:
        conn.close()


def test_ticket_requires_auth(client: TestClient) -> None:
    assert client.post("/api/v1/notifications/sse-ticket").status_code == 401


def test_issue_returns_opaque_ticket(client: TestClient) -> None:
    token = _register(client)
    response = _issue(client, token)
    assert response.status_code == 200, response.text
    ticket = response.json()["ticket"]
    assert isinstance(ticket, str) and len(ticket) >= 32
    assert token not in ticket


def test_ticket_ttl_is_30s() -> None:
    from app.api.v1 import realtime as realtime_module

    assert realtime_module.SSE_TICKET_TTL_SECONDS == 30


def test_stream_opens_with_ticket(live_base: str) -> None:
    token = _live_register(live_base)
    status, payload = _live_issue(live_base, token)
    assert status == 200, payload[:200]
    ticket = str(json.loads(payload)["ticket"])
    _, head = _live_stream_head(live_base, ticket)
    assert b"snapshot" in head, head[:200]
    assert b"unread" in head, head[:200]


def test_ticket_single_use(live_base: str) -> None:
    token = _live_register(live_base)
    _, payload = _live_issue(live_base, token)
    ticket = str(json.loads(payload)["ticket"])
    _live_stream_head(live_base, ticket)
    status, _ = _live_request(
        live_base, "GET", f"/api/v1/notifications/stream?ticket={quote(ticket)}"
    )
    assert status == 401


def test_unknown_ticket_rejected(client: TestClient) -> None:
    response = client.get(
        "/api/v1/notifications/stream", params={"ticket": "чужой-" + uuid.uuid4().hex}
    )
    assert response.status_code == 401


def test_missing_ticket_rejected(client: TestClient) -> None:
    assert client.get("/api/v1/notifications/stream").status_code == 401


def test_access_token_in_url_rejected(client: TestClient) -> None:
    token = _register(client)
    response = client.get(
        "/api/v1/notifications/stream", params={"access_token": token}
    )
    assert response.status_code == 400
    assert "X-Error-Code" in response.headers


def test_expired_ticket_rejected(client: TestClient, monkeypatch) -> None:
    from app.api.v1 import realtime as realtime_module

    monkeypatch.setattr(realtime_module, "SSE_TICKET_TTL_SECONDS", 1)
    token = _register(client)
    ticket = str(_issue(client, token).json()["ticket"])
    time.sleep(1.2)
    response = client.get("/api/v1/notifications/stream", params={"ticket": ticket})
    assert response.status_code == 401


def test_nginx_stream_query_excluded_from_access_log() -> None:
    source = (
        BACKEND_ROOT / "infra" / "nginx" / "nginx.prod.conf"
    ).read_text(encoding="utf-8")
    block = source.split("location /api/v1/notifications/stream", 1)[1].split("}", 1)[0]
    assert "access_token" not in source
    assert "access_log" in block
    for noisy in ('"$request"', "$args", "$query_string", "$request_uri", "$arg_"):
        assert noisy not in block
