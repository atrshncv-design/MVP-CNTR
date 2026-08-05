"""Тикет 09 Friday RC: комментарии заявок, PDF-заключение, очистка версий.

Покрытие: переписка участников и менеджера по конкретной заявке (US 53);
комментарии закрыты после подтверждения; PDF-заключение доступно после
решения (approved/rejected), только участникам/менеджерам; retention —
удаляются только старые версии вне снимков заявок.
"""

from __future__ import annotations

import io
import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user

PDF_BYTES = b"%PDF-1.4\n% sample\n%%EOF\n"

DB_DSN = "host=127.0.0.1 port=5432 user=technoz password=change_me dbname=technozrelost_test"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("t09"), full_name="Тикет09", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _published(client: TestClient, owner: str, mgr: str) -> tuple[int, str]:
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(owner),
        json={
            "name": "Проект-09",
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2, 3)
            ],
        },
    )
    assert response.status_code == 201, response.text
    pid = response.json()["id"]
    decide = client.post(
        f"/api/v1/manager/queue/drafts/{pid}/decide",
        headers=_auth(mgr),
        json={"approve": True, "level": 2},
    )
    assert decide.status_code == 200, decide.text
    reqs = client.get(
        f"/api/v1/projects/{pid}/stage-requirements", headers=_auth(owner)
    ).json()
    return pid, reqs[0]["id"]


def _upload_stage(client: TestClient, token: str, pid: int, rid: int, name: str) -> dict:
    response = client.post(
        f"/api/v1/projects/{pid}/stage-document-file",
        headers=_auth(token),
        data={"stage_requirement_id": str(rid), "title": name},
        files={"file": (name, io.BytesIO(PDF_BYTES), "application/pdf")},
    )
    assert response.status_code == 201, response.text
    return response.json()


# ── Комментарии (US 53) ──────────────────────────────────────────────────────


def test_comments_conversation_between_member_and_manager(client: TestClient) -> None:
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid, rid = _published(client, owner_token, mgr_token)
    request_id = _upload_stage(client, owner_token, pid, rid, "doc.pdf")["request_id"]

    added = client.post(
        f"/api/v1/projects/{pid}/requests/{request_id}/comments",
        headers=_auth(owner_token),
        json={"body": "Подскажите, чего не хватает в комплекте?"},
    )
    assert added.status_code == 201, added.text
    assert added.json()["author_id"] == owner_id

    replied = client.post(
        f"/api/v1/projects/{pid}/requests/{request_id}/comments",
        headers=_auth(mgr_token),
        json={"body": "Добавьте протокол испытаний"},
    )
    assert replied.status_code == 201, replied.text

    feed = client.get(
        f"/api/v1/projects/{pid}/requests/{request_id}/comments",
        headers=_auth(mgr_token),
    )
    assert feed.status_code == 200
    bodies = [c["body"] for c in feed.json()]
    assert bodies == ["Подскажите, чего не хватает в комплекте?", "Добавьте протокол испытаний"]


def test_comments_hidden_from_outsider(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    outsider_token, _ = _register(client, "investor")
    pid, rid = _published(client, owner_token, mgr_token)
    request_id = _upload_stage(client, owner_token, pid, rid, "doc.pdf")["request_id"]

    denied = client.get(
        f"/api/v1/projects/{pid}/requests/{request_id}/comments",
        headers=_auth(outsider_token),
    )
    assert denied.status_code == 404


def test_comments_closed_after_approval(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid, rid = _published(client, owner_token, mgr_token)
    request_id = _upload_stage(client, owner_token, pid, rid, "doc.pdf")["request_id"]

    # LLM недоступен → evaluation_unavailable; переводим в pending_manager
    import psycopg

    conn = psycopg.connect(DB_DSN, autocommit=True)
    try:
        conn.execute(
            "UPDATE public.promotion_requests SET status='pending_manager' WHERE id=%s",
            (request_id,),
        )
    finally:
        conn.close()

    approve = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True},
    )
    assert approve.status_code == 200, approve.text

    closed = client.post(
        f"/api/v1/projects/{pid}/requests/{request_id}/comments",
        headers=_auth(owner_token),
        json={"body": "Спасибо!"},
    )
    assert closed.status_code == 409


# ── PDF-заключение ───────────────────────────────────────────────────────────


def test_conclusion_pdf_after_decision(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid, rid = _published(client, owner_token, mgr_token)
    request_id = _upload_stage(client, owner_token, pid, rid, "doc.pdf")["request_id"]

    before = client.get(
        f"/api/v1/projects/{pid}/requests/{request_id}/conclusion.pdf",
        headers=_auth(owner_token),
    )
    assert before.status_code == 409  # решение ещё не принято

    import psycopg

    conn = psycopg.connect(DB_DSN, autocommit=True)
    try:
        conn.execute(
            "UPDATE public.promotion_requests SET status='pending_manager' WHERE id=%s",
            (request_id,),
        )
    finally:
        conn.close()
    client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True},
    )

    pdf = client.get(
        f"/api/v1/projects/{pid}/requests/{request_id}/conclusion.pdf",
        headers=_auth(owner_token),
    )
    assert pdf.status_code == 200
    assert pdf.content[:5] == b"%PDF-"
    assert "application/pdf" in pdf.headers["content-type"]

    denied = client.get(
        f"/api/v1/projects/{pid}/requests/{request_id}/conclusion.pdf",
        headers=_auth(_register(client, "investor")[0]),
    )
    assert denied.status_code == 404


# ── Очистка версий (retention) ───────────────────────────────────────────────


def test_cleanup_removes_old_versions_but_protects_snapshots(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid, rid = _published(client, owner_token, mgr_token)

    # v1 попадает в снимок заявки (защищена), v2 — последняя
    v1 = _upload_stage(client, owner_token, pid, rid, "doc.pdf")
    v2 = _upload_stage(client, owner_token, pid, rid, "doc.pdf")
    assert v1["doc_id"] != v2["doc_id"]

    # extra.pdf v1 (не в снимке) и v2 (последняя)
    extra_v1 = _upload_stage(client, owner_token, pid, rid, "extra.pdf")
    extra_v2 = _upload_stage(client, owner_token, pid, rid, "extra.pdf")

    cleanup = client.delete(
        f"/api/v1/projects/{pid}/files/old-versions", headers=_auth(owner_token)
    )
    assert cleanup.status_code == 200, cleanup.text
    assert cleanup.json()["removed"] == 1  # только extra_v1

    listing = client.get(
        f"/api/v1/projects/{pid}/files", headers=_auth(owner_token)
    ).json()
    remaining = {d["id"] for d in listing}
    assert extra_v1["doc_id"] not in remaining
    assert v1["doc_id"] in remaining  # защищена снимком
    assert v2["doc_id"] in remaining
    assert extra_v2["doc_id"] in remaining


def test_cleanup_forbidden_for_plain_member(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid, rid = _published(client, owner_token, mgr_token)

    member_token, _ = _register(client)
    # посторонний участник без полномочия project_admin → 403/404
    denied = client.delete(
        f"/api/v1/projects/{pid}/files/old-versions", headers=_auth(member_token)
    )
    assert denied.status_code in (403, 404)
