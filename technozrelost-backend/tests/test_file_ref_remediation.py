"""TICKET-01 (H-01) file_ref без bypass — ремедиация 3 теста."""

from __future__ import annotations

import io
import os
import uuid

import psycopg
from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email() -> str:
    return f"fileref-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str) -> int:
    resp = client.post(
        "/api/v1/projects",
        json={
            "name": "FileRef Test",
            "description": "test",
            "category": "IT",
            "target_level": 5,
            "questionnaire_results": [{"level_id": 1, "checked_items": ["a"], "percentage": 80.0}],
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_file_ref_rejects_non_slash_missing(client: TestClient) -> None:
    """Любой непустой file_ref без слэша без allowlist → 404."""
    data = register_test_user(client, email=_email(), full_name="FileRef A", role_slug="gk_customer")
    token = data["access_token"]
    pid = _create_project(client, token)

    resp = client.post(
        f"/api/v1/projects/{pid}/verification-docs",
        json={"title": "Подтверждение", "comment": "проверка", "file_ref": "evil"},
        headers=_auth(token),
    )
    assert resp.status_code == 404, resp.text
    assert "не найден" in resp.text.lower()

    # второй вариант с другим мусором
    resp2 = client.post(
        f"/api/v1/projects/{pid}/verification-docs",
        json={"title": "Подтверждение2", "file_ref": "evil-no-slash-missing"},
        headers=_auth(token),
    )
    assert resp2.status_code == 404


def test_file_ref_allows_legacy(client: TestClient) -> None:
    """Легаси allowlist ref-1 / ref-2 → 201 без проверки MinIO."""
    data = register_test_user(client, email=_email(), full_name="FileRef Legacy", role_slug="gk_customer")
    token = data["access_token"]
    pid = _create_project(client, token)

    for legacy in ("ref-1", "ref-2"):
        resp = client.post(
            f"/api/v1/projects/{pid}/verification-docs",
            json={"title": f"Legacy {legacy}", "file_ref": legacy},
            headers=_auth(token),
        )
        assert resp.status_code == 201, f"{legacy}: {resp.text}"
        assert resp.json()["file_ref"] == legacy

    # пустой и None — optional, тоже 201
    resp_empty = client.post(
        f"/api/v1/projects/{pid}/verification-docs",
        json={"title": "Empty", "file_ref": ""},
        headers=_auth(token),
    )
    assert resp_empty.status_code == 201

    resp_none = client.post(
        f"/api/v1/projects/{pid}/verification-docs",
        json={"title": "NoneRef"},
        headers=_auth(token),
    )
    assert resp_none.status_code == 201


def test_file_ref_allows_real_key(client: TestClient) -> None:
    """Реальный storage_key (ProjectDocument) → 201."""
    data = register_test_user(client, email=_email(), full_name="FileRef Real", role_slug="gk_customer")
    token = data["access_token"]
    pid = _create_project(client, token)

    # загружаем реальный файл
    pdf = b"%PDF-1.4\n% test\n%%EOF\n"
    upload = client.post(
        f"/api/v1/projects/{pid}/files",
        headers=_auth(token),
        files={"file": ("doc.pdf", io.BytesIO(pdf), "application/octet-stream")},
    )
    assert upload.status_code == 201, upload.text

    # достаём storage_key напрямую из БД (API его не отдаёт)
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        row = conn.execute(
            "SELECT storage_key FROM public.project_documents WHERE project_id=%s LIMIT 1",
            (pid,),
        ).fetchone()
        assert row is not None, "project_documents пуст"
        storage_key = row[0]
        assert "/" in storage_key
    finally:
        conn.close()

    resp = client.post(
        f"/api/v1/projects/{pid}/verification-docs",
        json={"title": "RealKey", "file_ref": storage_key},
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["file_ref"] == storage_key
