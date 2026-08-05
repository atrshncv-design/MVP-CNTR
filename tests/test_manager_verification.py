"""Тикет 08 Friday RC: менеджерская верификация УГТ.

Покрытие: первичное подтверждение на заявленный уровень (не ниже УГТ 2, не
выше preliminary); повышение строго N→N+1 от текущего уровня; устаревшая
заявка отклоняется (409); структурированный отказ с недостающими материалами;
история попыток видна владельцу и менеджеру.
"""

from __future__ import annotations

import uuid

import psycopg
from fastapi.testclient import TestClient

from tests.support import register_test_user

DB_DSN = "host=127.0.0.1 port=5432 user=technoz password=change_me dbname=technozrelost_test"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> str:
    return register_test_user(
        client, email=_email("verify"), full_name="Верификация", role_slug=role
    )["access_token"]


def _draft(client: TestClient, token: str, up_to: int) -> int:
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(token),
        json={
            "name": "Проект-верификация",
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in range(1, up_to + 1)
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _promotion_request(
    client: TestClient, owner: str, mgr: str, project_id: int
) -> int:
    """Комплект полон → автозаявка на повышение (LLM недоступен → пред. оценка)."""
    reqs = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(owner)
    ).json()
    up = client.post(
        f"/api/v1/projects/{project_id}/stage-documents",
        headers=_auth(owner),
        json={
            "stage_requirement_id": reqs[0]["id"],
            "title": "Акт",
            "content": "Текст комплекта",
        },
    )
    assert up.status_code == 201, up.text
    request_id = up.json()["request_id"]
    assert request_id is not None
    # LLM недоступен → evaluation_unavailable; менеджеру нужна pending_manager —
    # переключим статус напрямую через БД (как сделал бы запуск LLM SUCCESS)
    conn = psycopg.connect(DB_DSN, autocommit=True)
    try:
        conn.execute(
            "UPDATE public.promotion_requests SET status='pending_manager' WHERE id=%s",
            (request_id,),
        )
    finally:
        conn.close()
    return request_id


# ── Первичное подтверждение ──────────────────────────────────────────────────


def test_primary_approval_to_declared_level(client: TestClient) -> None:
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    project_id = _draft(client, owner, 7)

    decide = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr),
        json={"approve": True, "level": 7},
    )
    assert decide.status_code == 200, decide.text
    body = decide.json()
    assert body["status"] == "published"
    assert body["current_level"] == 7


def test_primary_approval_cannot_lower_below_ugt2(client: TestClient) -> None:
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    project_id = _draft(client, owner, 3)

    decide = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr),
        json={"approve": True, "level": 1},
    )
    assert decide.status_code == 400
    assert "ниже УГТ 2" in decide.text


def test_primary_approval_cannot_exceed_preliminary(client: TestClient) -> None:
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    project_id = _draft(client, owner, 5)

    decide = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr),
        json={"approve": True, "level": 8},
    )
    assert decide.status_code == 400
    assert "выше предварительного" in decide.text


def test_primary_rejection_structured(client: TestClient) -> None:
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    project_id = _draft(client, owner, 3)

    reject = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr),
        json={"approve": False, "reason": "Недостаточно доказательств"},
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "rejected"
    assert reject.json()["rejection_reason"] == "Недостаточно доказательств"


# ── Повышение N→N+1 ──────────────────────────────────────────────────────────


def test_promotion_approves_next_level_only(client: TestClient) -> None:
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    project_id = _draft(client, owner, 3)
    client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr),
        json={"approve": True, "level": 2},
    )
    request_id = _promotion_request(client, owner, mgr, project_id)

    approve = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr),
        json={"approve": True},
    )
    assert approve.status_code == 200, approve.text
    assert approve.json()["status"] == "approved"

    card = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner)).json()
    assert card["project"]["current_level"] == 3

    # повторное решение по той же заявке — 404 (уже рассмотрена)
    again = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr),
        json={"approve": True},
    )
    assert again.status_code == 404


def test_promotion_rejects_stale_request(client: TestClient) -> None:
    """Уровень проекта изменился → заявка 2→3 устарела (409)."""
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    project_id = _draft(client, owner, 3)
    client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr),
        json={"approve": True, "level": 2},
    )
    request_id = _promotion_request(client, owner, mgr, project_id)

    conn = psycopg.connect(DB_DSN, autocommit=True)
    try:
        conn.execute(
            "UPDATE public.projects SET current_level=4 WHERE id=%s", (project_id,)
        )
    finally:
        conn.close()

    decide = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr),
        json={"approve": True},
    )
    assert decide.status_code == 409
    assert "переоформите" in decide.text


def test_promotion_rejection_with_missing_materials(client: TestClient) -> None:
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    project_id = _draft(client, owner, 3)
    client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr),
        json={"approve": True, "level": 2},
    )
    request_id = _promotion_request(client, owner, mgr, project_id)

    reject = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr),
        json={
            "approve": False,
            "reason": "Комплект неполон",
            "missing": ["Акт испытаний", "Протокол измерений"],
        },
    )
    assert reject.status_code == 200
    body = reject.json()
    assert body["status"] == "rejected"
    assert body["rejection_reason"] == "Комплект неполон"
    assert body["evaluation_result"]["missing_required"] == [
        "Акт испытаний",
        "Протокол измерений",
    ]


# ── История ──────────────────────────────────────────────────────────────────


def test_history_shows_attempts(client: TestClient) -> None:
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    project_id = _draft(client, owner, 3)
    client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr),
        json={"approve": True, "level": 2},
    )
    request_id = _promotion_request(client, owner, mgr, project_id)
    client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr),
        json={"approve": False, "reason": "Не хватает обоснований"},
    )

    history = client.get(
        f"/api/v1/manager/queue/history/{project_id}", headers=_auth(mgr)
    )
    assert history.status_code == 200, history.text
    attempts = history.json()
    assert len(attempts) == 1
    assert attempts[0]["status"] == "rejected"
    assert attempts[0]["rejection_reason"] == "Не хватает обоснований"

    # владелец не имеет доступа к менеджерской истории (US 55 — история менеджера)
    denied = client.get(
        f"/api/v1/manager/queue/history/{project_id}", headers=_auth(owner)
    )
    assert denied.status_code == 403
