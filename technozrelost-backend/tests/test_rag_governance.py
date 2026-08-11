"""Тикет 01 ai-rag: редакционный workflow базы знаний.

Покрытие:
- RBAC: только staff (cntr_admin/cntr_manager) создаёт/публикует/отзывает/рецензирует.
- publish требует prompt-injection review (is_ai_reviewed=True).
- retire: документ исчезает из search, запись в rag_retired_log, аудит;
  повторный retire -> 409; retire черновика -> 400.
- search возвращает ТОЛЬКО published; draft/retired не попадают.
- Guard: search не принимает project_id (extra="forbid" -> 422).
"""

from __future__ import annotations

import os
import uuid

import psycopg
from fastapi.testclient import TestClient

from tests.support import register_test_user

RAG_TEXT = (
    "УГТ 5: компоненты технологии интегрированы и испытаны "
    "в условиях, близких к реальным."
)
RAG_QUERY = "УГТ 5 компоненты"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("gov"), full_name="Gov User", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _create_draft(client: TestClient, token: str, **overrides: str) -> dict:
    payload = {
        "title": "ГОСТ Р 58048-2017 — УГТ 5",
        "doc_type": "gost",
        "ugt_level": 5,
        "raw_text": RAG_TEXT,
        "source_uri": "gost/58048#ugt5",
        "source_type": "gov",
    }
    payload.update(overrides)
    response = client.post(
        "/api/v1/rag/documents", json=payload, headers=_auth(token)
    )
    assert response.status_code == 201, response.text
    return response.json()


def _publish_flow(client: TestClient, token: str, doc_id: int) -> None:
    reviewed = client.post(f"/api/v1/rag/documents/{doc_id}/review", headers=_auth(token))
    assert reviewed.status_code == 200, reviewed.text
    published = client.post(f"/api/v1/rag/documents/{doc_id}/publish", headers=_auth(token))
    assert published.status_code == 200, published.text


def _search(client: TestClient, token: str, query: str = RAG_QUERY) -> list[dict]:
    response = client.post(
        "/api/v1/rag/search", json={"query": query}, headers=_auth(token)
    )
    assert response.status_code == 200, response.text
    return response.json()


def _db_conn():
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


def _audit_actions() -> list[str]:
    with _db_conn() as conn:
        rows = conn.execute(
            "SELECT action FROM public.audit_trail ORDER BY id"
        ).fetchall()
    return [row[0] for row in rows]


def _retired_log_rows() -> list[tuple]:
    with _db_conn() as conn:
        rows = conn.execute(
            "SELECT document_id, retired_by, reason FROM public.rag_retired_log ORDER BY id"
        ).fetchall()
    return [(r[0], r[1], r[2]) for r in rows]


# ─── RBAC: только staff ──────────────────────────────────────────────────────


def test_non_staff_cannot_manage_documents(client: TestClient) -> None:
    user_token, _ = _register(client, "gk_customer")

    created = client.post(
        "/api/v1/rag/documents",
        json={
            "title": "Взлом",
            "doc_type": "gost",
            "raw_text": "попытка не-staff создать материал",
        },
        headers=_auth(user_token),
    )
    assert created.status_code == 403, created.text

    for endpoint in (
        "/api/v1/rag/documents/1/review",
        "/api/v1/rag/documents/1/publish",
        "/api/v1/rag/documents/1/retire",
    ):
        response = client.post(endpoint, headers=_auth(user_token))
        assert response.status_code == 403, f"{endpoint}: {response.text}"

    listing = client.get("/api/v1/rag/documents", headers=_auth(user_token))
    assert listing.status_code == 403, listing.text


def test_staff_creates_draft_with_audit(client: TestClient) -> None:
    staff_token, staff_id = _register(client, "cntr_admin")

    doc = _create_draft(client, staff_token)
    assert doc["status"] == "draft"
    assert doc["version"] == 1
    assert doc["source_type"] == "gov"
    assert doc["is_ai_reviewed"] is False
    assert doc["published_at"] is None

    assert "rag.document_created" in _audit_actions()

    listing = client.get("/api/v1/rag/documents", headers=_auth(staff_token))
    assert listing.status_code == 200, listing.text
    assert any(d["id"] == doc["id"] and d["status"] == "draft" for d in listing.json())

    # Пользовательские проекты/файлы/чаты не индексируются: guard на project_id
    assert staff_id  # staff авторизован


# ─── publish требует review ──────────────────────────────────────────────────


def test_publish_requires_ai_review(client: TestClient) -> None:
    staff_token, _ = _register(client, "cntr_admin")
    doc = _create_draft(client, staff_token)

    # Без review — 400
    first = client.post(
        f"/api/v1/rag/documents/{doc['id']}/publish", headers=_auth(staff_token)
    )
    assert first.status_code == 400, first.text

    # Review — 200
    reviewed = client.post(
        f"/api/v1/rag/documents/{doc['id']}/review", headers=_auth(staff_token)
    )
    assert reviewed.status_code == 200, reviewed.text
    reviewed_data = reviewed.json()
    assert reviewed_data["is_ai_reviewed"] is True
    assert reviewed_data["reviewed_at"] is not None
    assert "rag.document_reviewed" in _audit_actions()

    # После review — публикация 200 + аудит
    published = client.post(
        f"/api/v1/rag/documents/{doc['id']}/publish", headers=_auth(staff_token)
    )
    assert published.status_code == 200, published.text
    published_data = published.json()
    assert published_data["status"] == "published"
    assert published_data["published_at"] is not None
    assert "rag.document_published" in _audit_actions()


# ─── retire: исчезает из search + лог + аудит ───────────────────────────────


def test_retire_removes_from_search_and_logs(client: TestClient) -> None:
    staff_token, staff_id = _register(client, "cntr_manager")
    user_token, _ = _register(client, "gk_customer")

    doc = _create_draft(client, staff_token)
    _publish_flow(client, staff_token, doc["id"])

    # До отзыва документ находится поиском
    assert any(r["document"]["id"] == doc["id"] for r in _search(client, user_token))

    retired = client.post(
        f"/api/v1/rag/documents/{doc['id']}/retire",
        json={"reason": "Устаревшая редакция ГОСТ"},
        headers=_auth(staff_token),
    )
    assert retired.status_code == 200, retired.text
    assert retired.json()["status"] == "retired"
    assert retired.json()["retired_at"] is not None

    # После отзыва документ исчезает из retrieval
    assert all(r["document"]["id"] != doc["id"] for r in _search(client, user_token))

    # Append-only лог отзыва
    log_rows = _retired_log_rows()
    assert any(
        row[0] == doc["id"] and row[1] == staff_id and row[2] == "Устаревшая редакция ГОСТ"
        for row in log_rows
    )

    # Аудит
    assert "rag.document_retired" in _audit_actions()

    # Повторный retire — 409
    again = client.post(
        f"/api/v1/rag/documents/{doc['id']}/retire",
        json={"reason": "Ещё раз"},
        headers=_auth(staff_token),
    )
    assert again.status_code == 409, again.text


def test_retire_draft_returns_400(client: TestClient) -> None:
    staff_token, _ = _register(client, "cntr_admin")
    doc = _create_draft(client, staff_token)

    response = client.post(
        f"/api/v1/rag/documents/{doc['id']}/retire", headers=_auth(staff_token)
    )
    assert response.status_code == 400, response.text
    assert _retired_log_rows() == []


# ─── search: только published ────────────────────────────────────────────────


def test_search_excludes_draft_and_retired(client: TestClient) -> None:
    staff_token, _ = _register(client, "cntr_admin")
    user_token, _ = _register(client, "gk_customer")

    # Черновик — не ищется
    draft = _create_draft(client, staff_token)
    assert all(r["document"]["id"] != draft["id"] for r in _search(client, user_token))

    # Опубликованный — ищется
    published = _create_draft(
        client,
        staff_token,
        title="ГОСТ Р 58048-2017 — УГТ 5 (v2)",
        source_uri="gost/58048#v2",
        raw_text=(
            "УГТ 5: компоненты технологии интегрированы и испытаны "
            "в условиях, близких к реальным. Критерии оценки."
        ),
    )
    _publish_flow(client, staff_token, published["id"])
    found = _search(client, user_token)
    assert any(r["document"]["id"] == published["id"] for r in found)
    assert all(r["document"]["id"] != draft["id"] for r in found)

    # Отозванный — больше не ищется
    retired = client.post(
        f"/api/v1/rag/documents/{published['id']}/retire",
        json={"reason": "Отозван"},
        headers=_auth(staff_token),
    )
    assert retired.status_code == 200, retired.text
    assert all(
        r["document"]["id"] != published["id"] for r in _search(client, user_token)
    )


# ─── guard: без project_id ───────────────────────────────────────────────────


def test_search_rejects_project_id(client: TestClient) -> None:
    user_token, _ = _register(client, "gk_customer")

    response = client.post(
        "/api/v1/rag/search",
        json={"query": RAG_QUERY, "project_id": 42},
        headers=_auth(user_token),
    )
    assert response.status_code == 422, response.text
