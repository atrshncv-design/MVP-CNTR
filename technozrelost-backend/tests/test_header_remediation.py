"""TICKET-02 (H-02b) CRLF в заголовках — ремедиация 2 теста."""

from __future__ import annotations

import io
import os
import uuid

import psycopg
from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email() -> str:
    return f"hdr-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str) -> int:
    resp = client.post(
        "/api/v1/projects",
        json={
            "name": "Header Test",
            "category": "IT",
            "target_level": 5,
            "questionnaire_results": [{"level_id": 1, "checked_items": ["a"], "percentage": 80.0}],
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_download_crlf_escaped(client: TestClient) -> None:
    """Content-Disposition без CRLF и кавычек даже при зловредном имени."""
    data = register_test_user(client, email=_email(), full_name="Header User", role_slug="gk_customer")
    token = data["access_token"]
    pid = _create_project(client, token)

    pdf = b"%PDF-1.4\n% test\n%%EOF\n"
    upload = client.post(
        f"/api/v1/projects/{pid}/files",
        headers=_auth(token),
        files={"file": ("doc.pdf", io.BytesIO(pdf), "application/octet-stream")},
    )
    assert upload.status_code == 201, upload.text
    fid = upload.json()["id"]

    # подменяем имя на CRLF-инъекцию напрямую в БД
    malicious = 'a\r\nb"c.pdf'
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        conn.execute("UPDATE public.project_documents SET file_name=%s WHERE id=%s", (malicious, fid))
    finally:
        conn.close()

    download = client.get(f"/api/v1/files/{fid}/download", headers=_auth(token))
    assert download.status_code == 200, download.text

    cd = download.headers.get("content-disposition", "")
    assert "\r" not in cd, f"CRLF in header: {cd!r}"
    assert "\n" not in cd, f"CRLF in header: {cd!r}"
    # кавычка внутри filename="..." должна быть экранирована
    # fallback делает re.sub(r'[\r\n\"]', "_", ...) → в filename="..." не должно быть голой "
    # проверяем, что после filename=" не идёт сразу b"c
    # проще: внутри кавычек нет " и нет \r\n
    assert cd.count('"') >= 2  # есть обрамляющие кавычки
    # извлекаем fallback часть
    try:
        fallback_part = cd.split('filename="')[1].split('"')[0]
        assert '"' not in fallback_part
        assert "\r" not in fallback_part
        assert "\n" not in fallback_part
    except IndexError:
        pass
    # filename* сохраняет оригинал кодированно, но не должен содержать голый \r\n в заголовке
    assert "filename*=UTF-8''" in cd


def test_request_id_crlf_generates(client: TestClient) -> None:
    """X-Request-ID CRLF → генерируется 32 hex, не echo, без инъекции."""
    # CRLF
    resp = client.get("/api/v1/health", headers={"X-Request-ID": "a\r\nX-Injected: 1"})
    assert resp.status_code == 200
    req_id = resp.headers.get("x-request-id", "")
    assert "\r" not in req_id and "\n" not in req_id, f"req_id содержит CRLF: {req_id!r}"
    assert req_id != "a\r\nX-Injected: 1"
    assert ":" not in req_id
    assert len(req_id) == 32
    assert all(c in "0123456789abcdefABCDEF" for c in req_id)
    # второй заголовок не просочился
    assert "x-injected" not in {k.lower() for k in resp.headers.keys()}
    for v in resp.headers.values():
        assert "X-Injected" not in v

    # короткий (<8) → тоже генерируется
    short = client.get("/api/v1/health", headers={"X-Request-ID": "short"})
    assert short.headers["x-request-id"] != "short"
    assert len(short.headers["x-request-id"]) == 32

    # валидный echo
    valid = "ValidReqID_123"
    echoed = client.get("/api/v1/health", headers={"X-Request-ID": valid})
    assert echoed.headers["x-request-id"] == valid

    # с пробелами по краям — strip и echo
    spaced = client.get("/api/v1/health", headers={"X-Request-ID": "  ValidReqID_123  "})
    assert spaced.headers["x-request-id"] == "ValidReqID_123"
