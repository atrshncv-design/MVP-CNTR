"""Тикет 04 requests-matching: управляемый контакт и связанный проект.

Покрытие: обезличенное предложение кандидату (staff; БЕЗ контактов и
закрытых полей; дубликат 409; не-кандидат пула 404; уведомление + аудит);
лента /offers/mine — только свои; согласие → accepted + responded_at +
disclosure pending (аудит offer_accepted + disclosure_requested); отказ →
declined; решение по раскрытию (approved → контакты кандидату; denied →
причина; повторное 409; RBAC 404); связанный проект наследует ТОЛЬКО
выбранные поля; приглашение кандидата через существующий join-флоу
(join_token + /projects/join, auto_accept для staff); RBAC (не-участник 404).
"""

from __future__ import annotations

import os

import psycopg
from fastapi.testclient import TestClient

from tests.test_tech_requests import (
    _audit_actions,
    _auth,
    _create_request,
    _register,
    _register_manager,
)

# ─── Helpers ─────────────────────────────────────────────────────────────────


def _db() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


def _register_executor(client: TestClient) -> dict:
    return _register(client, role="rd_executor")


def _create_verified_org(
    client: TestClient, token: str, *, org_type: str | None = None
) -> int:
    """Организация: создание (опционально org_type) → submit → verify."""
    payload: dict[str, object] = {"name": "ООО ТехноЗаказчик"}
    if org_type:
        payload["org_type"] = org_type
        payload["region"] = "Москва"
    response = client.post("/api/v1/orgs", headers=_auth(token), json=payload)
    assert response.status_code == 201, response.text
    org_id = response.json()["id"]
    submitted = client.post(f"/api/v1/orgs/{org_id}/submit", headers=_auth(token))
    assert submitted.status_code == 200, submitted.text
    manager = _register_manager(client)
    decided = client.post(
        f"/api/v1/manager/orgs/{org_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"action": "verify", "comment": "ОК"},
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["state"] == "verified"
    return org_id


def _submit(client: TestClient, token: str, request_id: int) -> None:
    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/submit", headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text


def _make_offer(
    client: TestClient,
    manager_token: str,
    request_id: int,
    candidate_id: int,
    *,
    message: str = "Обезличенное предложение по вашему профилю",
) -> dict:
    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/offers",
        headers=_auth(manager_token),
        json={"candidate_id": candidate_id, "message": message},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _accept(client: TestClient, token: str, offer_id: int) -> dict:
    resp = client.post(f"/api/v1/offers/{offer_id}/accept", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


def _decide(
    client: TestClient, token: str, disclosure_id: int, *, approve: bool, reason: str | None
) -> dict:
    payload: dict[str, object] = {"approve": approve}
    if reason is not None:
        payload["reason"] = reason
    resp = client.post(
        f"/api/v1/disclosures/{disclosure_id}/decide",
        headers=_auth(token),
        json=payload,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _link_project(
    client: TestClient,
    token: str,
    offer_id: int,
    *,
    project_id: int | None = None,
    selected_fields: list[str],
) -> dict:
    payload: dict[str, object] = {"selected_fields": selected_fields}
    if project_id is not None:
        payload["project_id"] = project_id
    resp = client.post(
        f"/api/v1/offers/{offer_id}/project", headers=_auth(token), json=payload
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _disclosure_row(offer_id: int) -> dict | None:
    conn = _db()
    try:
        row = conn.execute(
            "SELECT id, offer_id, requested_by, status, decided_by, decided_at, reason "
            "FROM public.tech_request_disclosures WHERE offer_id = %s",
            (offer_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0],
            "offer_id": row[1],
            "requested_by": row[2],
            "status": row[3],
            "decided_by": row[4],
            "decided_at": row[5],
            "reason": row[6],
        }
    finally:
        conn.close()


def _link_row(offer_id: int) -> dict | None:
    conn = _db()
    try:
        row = conn.execute(
            "SELECT request_id, offer_id, project_id, created_by, selected_fields "
            "FROM public.tech_request_projects WHERE offer_id = %s",
            (offer_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "request_id": row[0],
            "offer_id": row[1],
            "project_id": row[2],
            "created_by": row[3],
            "selected_fields": row[4],
        }
    finally:
        conn.close()


def _notifications(client: TestClient, token: str) -> list[dict]:
    resp = client.get("/api/v1/notifications", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


def _project_detail(client: TestClient, token: str, project_id: int) -> dict:
    resp = client.get(f"/api/v1/projects/{project_id}", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    return resp.json()["project"]


# ── Обезличенное предложение: создание, лента, RBAC ─────────────────────────


def test_offer_created_anonymous_and_candidate_notified(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    _submit(client, owner["access_token"], request_id)

    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])
    assert offer["status"] == "pending"
    assert offer["candidate_id"] == executor["user"]["id"]
    assert offer["offered_by"] == manager["user"]["id"]
    assert offer["responded_at"] is None

    # Уведомление кандидату (notify_user).
    inbox = _notifications(client, executor["access_token"])
    assert any(n["type"] == "tech_request.offer" for n in inbox)

    # Аудит offer_created.
    audit = _audit_actions(client, "tech_request.offer_created")
    assert any(e["details"].get("offer_id") == offer["id"] for e in audit)

    # Лента кандидата: обезличенная — без контактов и закрытых полей.
    mine = client.get("/api/v1/offers/mine", headers=_auth(executor["access_token"]))
    assert mine.status_code == 200, mine.text
    body = mine.json()
    assert len(body) == 1
    item = body[0]
    assert item["id"] == offer["id"]
    # До accept раскрытие ещё не запрошено (disclosure создаётся при accept).
    assert item["disclosure_status"] is None
    assert item["contacts"] is None
    text = str(body)
    assert "@" not in text  # нет email/контактов
    assert "budget" not in text  # закрытые поля не раскрываются


def test_offer_creation_rbac_and_validation(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])

    # Только staff: создатель запроса (не staff) → 403.
    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/offers",
        headers=_auth(owner["access_token"]),
        json={"candidate_id": executor["user"]["id"]},
    )
    assert resp.status_code == 403, resp.text

    # Несуществующий запрос → 404.
    resp = client.post(
        "/api/v1/tech-requests/999999/offers",
        headers=_auth(manager["access_token"]),
        json={"candidate_id": executor["user"]["id"]},
    )
    assert resp.status_code == 404, resp.text

    # Кандидат вне пула исполнителей → 404.
    stranger = _register(client)
    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/offers",
        headers=_auth(manager["access_token"]),
        json={"candidate_id": stranger["user"]["id"]},
    )
    assert resp.status_code == 404, resp.text

    # Повторное предложение той же паре → 409 (UNIQUE).
    _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])
    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/offers",
        headers=_auth(manager["access_token"]),
        json={"candidate_id": executor["user"]["id"]},
    )
    assert resp.status_code == 409, resp.text


def test_offers_mine_only_own_and_request_list_rbac(client: TestClient) -> None:
    owner = _register(client)
    executor_a = _register_executor(client)
    executor_b = _register_executor(client)
    stranger = _register(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])

    offer_a = _make_offer(
        client, manager["access_token"], request_id, executor_a["user"]["id"]
    )
    _make_offer(client, manager["access_token"], request_id, executor_b["user"]["id"])

    # Кандидат видит ТОЛЬКО свои офферы.
    mine_a = client.get("/api/v1/offers/mine", headers=_auth(executor_a["access_token"]))
    assert mine_a.status_code == 200, mine_a.text
    assert [o["id"] for o in mine_a.json()] == [offer_a["id"]]

    mine_b = client.get("/api/v1/offers/mine", headers=_auth(executor_b["access_token"]))
    assert len(mine_b.json()) == 1
    assert mine_b.json()[0]["id"] != offer_a["id"]

    # Чужой оффер не виден: GET /offers/{id} → 404.
    resp = client.get(
        f"/api/v1/offers/{offer_a['id']}", headers=_auth(executor_b["access_token"])
    )
    assert resp.status_code == 404, resp.text

    # Список офферов запроса — создатель и staff; чужой → 404.
    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/offers",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 2
    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/offers",
        headers=_auth(manager["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/offers",
        headers=_auth(stranger["access_token"]),
    )
    assert resp.status_code == 404, resp.text


# ── Согласие/отказ: статусы, timestamps, аудит ──────────────────────────────


def test_accept_requests_disclosure(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])

    accepted = _accept(client, executor["access_token"], offer["id"])
    assert accepted["status"] == "accepted"
    assert accepted["responded_at"] is not None
    assert accepted["disclosure_status"] == "pending"

    # Disclosure pending в БД.
    row = _disclosure_row(offer["id"])
    assert row is not None
    assert row["status"] == "pending"
    assert row["requested_by"] == executor["user"]["id"]
    assert row["decided_by"] is None

    # Аудит: согласие + запрос раскрытия.
    accepted_audit = _audit_actions(client, "tech_request.offer_accepted")
    assert any(e["details"].get("offer_id") == offer["id"] for e in accepted_audit)
    requested_audit = _audit_actions(client, "tech_request.disclosure_requested")
    assert any(e["details"].get("offer_id") == offer["id"] for e in requested_audit)

    # Уведомление создателю запроса.
    inbox = _notifications(client, owner["access_token"])
    assert any(n["type"] == "tech_request.disclosure_requested" for n in inbox)

    # Повторное согласие → 409.
    resp = client.post(
        f"/api/v1/offers/{offer['id']}/accept", headers=_auth(executor["access_token"])
    )
    assert resp.status_code == 409, resp.text


def test_accept_foreign_offer_404(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    stranger = _register(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])

    # Чужой кандидат / посторонний → 404 (IDOR).
    resp = client.post(
        f"/api/v1/offers/{offer['id']}/accept", headers=_auth(stranger["access_token"])
    )
    assert resp.status_code == 404, resp.text
    resp = client.post(
        f"/api/v1/offers/{offer['id']}/decline", headers=_auth(stranger["access_token"])
    )
    assert resp.status_code == 404, resp.text


def test_decline_offer(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])

    resp = client.post(
        f"/api/v1/offers/{offer['id']}/decline", headers=_auth(executor["access_token"])
    )
    assert resp.status_code == 200, resp.text
    declined = resp.json()
    assert declined["status"] == "declined"
    assert declined["responded_at"] is not None
    # Disclosure НЕ создаётся при отказе.
    assert _disclosure_row(offer["id"]) is None

    audit = _audit_actions(client, "tech_request.offer_declined")
    assert any(e["details"].get("offer_id") == offer["id"] for e in audit)

    # После отказа согласиться нельзя.
    resp = client.post(
        f"/api/v1/offers/{offer['id']}/accept", headers=_auth(executor["access_token"])
    )
    assert resp.status_code == 409, resp.text


# ── Раскрытие: решение staff/создателя, контакты, аудит ─────────────────────


def test_disclosure_approved_reveals_contacts(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])
    _accept(client, executor["access_token"], offer["id"])
    disclosure_id = _disclosure_row(offer["id"])["id"]

    # До решения кандидат не видит контакты.
    before = client.get("/api/v1/offers/mine", headers=_auth(executor["access_token"])).json()
    assert before[0]["contacts"] is None

    decided = _decide(
        client, manager["access_token"], disclosure_id, approve=True, reason=None
    )
    assert decided["status"] == "approved"
    assert decided["decided_by"] == manager["user"]["id"]
    assert decided["decided_at"] is not None

    row = _disclosure_row(offer["id"])
    assert row["status"] == "approved"
    assert row["decided_at"] is not None

    # Аудит + уведомление кандидату.
    audit = _audit_actions(client, "tech_request.disclosure_approved")
    assert any(e["details"].get("disclosure_id") == disclosure_id for e in audit)
    inbox = _notifications(client, executor["access_token"])
    assert any(n["type"] == "tech_request.disclosure_approved" for n in inbox)

    # После approved кандидат видит контакты и полные данные.
    after = client.get("/api/v1/offers/mine", headers=_auth(executor["access_token"])).json()
    assert after[0]["contacts"] is not None
    assert after[0]["contacts"]["creator_email"] == owner["user"]["email"]
    assert after[0]["contacts"]["organization_name"] == "ООО ТехноЗаказчик"
    assert after[0]["contacts"]["budget"] == 5_000_000


def test_disclosure_denied_requires_reason(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])
    _accept(client, executor["access_token"], offer["id"])
    disclosure_id = _disclosure_row(offer["id"])["id"]

    # Отказ без причины → 422.
    resp = client.post(
        f"/api/v1/disclosures/{disclosure_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"approve": False},
    )
    assert resp.status_code == 422, resp.text

    decided = _decide(
        client, manager["access_token"], disclosure_id, approve=False, reason="НДA-ограничения"
    )
    assert decided["status"] == "denied"
    assert decided["reason"] == "НДA-ограничения"
    assert decided["decided_by"] == manager["user"]["id"]

    row = _disclosure_row(offer["id"])
    assert row["status"] == "denied"
    assert row["reason"] == "НДA-ограничения"
    assert row["decided_at"] is not None

    audit = _audit_actions(client, "tech_request.disclosure_denied")
    assert any(e["details"].get("disclosure_id") == disclosure_id for e in audit)
    inbox = _notifications(client, executor["access_token"])
    assert any(n["type"] == "tech_request.disclosure_denied" for n in inbox)

    # Контакты НЕ раскрываются после отказа.
    after = client.get("/api/v1/offers/mine", headers=_auth(executor["access_token"])).json()
    assert after[0]["contacts"] is None

    # Повторное решение → 409.
    resp = client.post(
        f"/api/v1/disclosures/{disclosure_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"approve": True},
    )
    assert resp.status_code == 409, resp.text


def test_disclosure_decide_rbac(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    stranger = _register(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])
    _accept(client, executor["access_token"], offer["id"])
    disclosure_id = _disclosure_row(offer["id"])["id"]

    # Посторонний → 404 (IDOR).
    resp = client.post(
        f"/api/v1/disclosures/{disclosure_id}/decide",
        headers=_auth(stranger["access_token"]),
        json={"approve": True},
    )
    assert resp.status_code == 404, resp.text

    # Создатель запроса тоже может принять решение.
    decided = _decide(
        client, owner["access_token"], disclosure_id, approve=True, reason=None
    )
    assert decided["status"] == "approved"
    assert decided["decided_by"] == owner["user"]["id"]


# ── Связанный проект: наследование только выбранных полей ───────────────────


def _owner_with_ugt(client: TestClient, token: str) -> None:
    """Создаёт проект владельца с текущим УГТ=2 (для target_ugt запроса)."""
    resp = client.post(
        "/api/v1/projects",
        headers=_auth(token),
        json={
            "name": "Проект заказчика",
            "questionnaire_results": [
                {"level_id": 1, "percentage": 85.0, "checked_items": ["a"]},
                {"level_id": 2, "percentage": 75.0, "checked_items": ["b"]},
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["current_level"] == 2


def test_project_link_inherits_only_selected_fields(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    _owner_with_ugt(client, owner["access_token"])
    org_id = _create_verified_org(client, owner["access_token"], org_type="it")
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    _submit(client, owner["access_token"], request_id)
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])
    _accept(client, executor["access_token"], offer["id"])
    disclosure_id = _disclosure_row(offer["id"])["id"]
    _decide(client, manager["access_token"], disclosure_id, approve=True, reason=None)

    # Новый проект наследует ТОЛЬКО name; description/category/target_level — нет.
    linked = _link_project(
        client, manager["access_token"], offer["id"], selected_fields=["name"]
    )
    project = _project_detail(client, manager["access_token"], linked["project_id"])
    req = client.get(
        f"/api/v1/tech-requests/{request_id}", headers=_auth(owner["access_token"])
    ).json()
    assert project["name"] == req["title"]
    assert project["description"] is None
    assert project["category"] is None
    assert project["target_level"] == 9  # не выбрано → дефолт
    assert project["budget"] is None  # бюджет — закрытое поле, не наследуется

    # Связь в БД: selected_fields = {name: title}.
    row = _link_row(offer["id"])
    assert row is not None
    assert row["request_id"] == request_id
    assert row["project_id"] == linked["project_id"]
    assert row["selected_fields"] == {"name": "title"}

    audit = _audit_actions(client, "tech_request.project_linked")
    assert any(e["details"].get("offer_id") == offer["id"] for e in audit)


def test_project_link_all_fields_inherited(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    _owner_with_ugt(client, owner["access_token"])
    org_id = _create_verified_org(client, owner["access_token"], org_type="it")
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])
    _accept(client, executor["access_token"], offer["id"])
    disclosure_id = _disclosure_row(offer["id"])["id"]
    _decide(client, manager["access_token"], disclosure_id, approve=True, reason=None)

    linked = _link_project(
        client,
        manager["access_token"],
        offer["id"],
        selected_fields=["name", "description", "category", "target_level"],
    )
    project = _project_detail(client, manager["access_token"], linked["project_id"])
    req = client.get(
        f"/api/v1/tech-requests/{request_id}", headers=_auth(owner["access_token"])
    ).json()
    assert project["name"] == req["title"]
    assert project["description"] == req["requirements"]
    assert project["category"] == "it"  # org_type организации-заказчика
    assert project["target_level"] == 2  # target_ugt из проектов создателя

    row = _link_row(offer["id"])
    assert row["selected_fields"] == {
        "name": "title",
        "description": "requirements",
        "category": "org_type",
        "target_level": "target_ugt",
    }


def test_project_link_existing_project_only_link(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])

    existing = client.post(
        "/api/v1/projects",
        headers=_auth(manager["access_token"]),
        json={"name": "Существующий проект", "description": "Не трогать"},
    )
    assert existing.status_code == 201, existing.text
    existing_id = existing.json()["id"]

    linked = _link_project(
        client,
        manager["access_token"],
        offer["id"],
        project_id=existing_id,
        selected_fields=["name"],
    )
    assert linked["project_id"] == existing_id

    # Существующий проект НЕ изменяется (только связь + selected_fields).
    project = _project_detail(client, manager["access_token"], existing_id)
    assert project["name"] == "Существующий проект"
    assert project["description"] == "Не трогать"


def test_project_link_invites_via_join_flow(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])
    _accept(client, executor["access_token"], offer["id"])
    disclosure_id = _disclosure_row(offer["id"])["id"]
    _decide(client, manager["access_token"], disclosure_id, approve=True, reason=None)

    linked = _link_project(
        client,
        manager["access_token"],
        offer["id"],
        selected_fields=["name", "description"],
    )
    project_id = linked["project_id"]

    # Приглашение кандидату: уведомление с join_token + shared_by (staff).
    inbox = _notifications(client, executor["access_token"])
    invite = next(
        n for n in inbox if n["type"] == "tech_request.project_invited"
    )
    token = invite["payload"]["join_token"]
    assert invite["payload"]["project_id"] == project_id

    # Кандидат вступает через СУЩЕСТВУЮЩИЙ join-флоу (/projects/join).
    joined = client.post(
        "/api/v1/projects/join",
        headers=_auth(executor["access_token"]),
        json={
            "token": token,
            "role_in_project": "executor",
            "shared_by": invite["payload"]["shared_by"],
        },
    )
    assert joined.status_code == 200, joined.text
    assert joined.json()["status"] == "active"  # auto_accept: пригласил staff

    # Кандидат — активный участник проекта.
    project = _project_detail(client, executor["access_token"], project_id)
    assert project["name"] == linked["project_name"]


def test_project_link_rbac_and_validation(client: TestClient) -> None:
    owner = _register(client)
    executor = _register_executor(client)
    stranger = _register(client)
    manager = _register_manager(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = int(_create_request(client, owner["access_token"], org_id)["id"])
    offer = _make_offer(client, manager["access_token"], request_id, executor["user"]["id"])

    # Посторонний → 404 (IDOR).
    resp = client.post(
        f"/api/v1/offers/{offer['id']}/project",
        headers=_auth(stranger["access_token"]),
        json={"selected_fields": ["name"]},
    )
    assert resp.status_code == 404, resp.text

    # Недопустимое поле наследования → 422.
    resp = client.post(
        f"/api/v1/offers/{offer['id']}/project",
        headers=_auth(manager["access_token"]),
        json={"selected_fields": ["budget"]},
    )
    assert resp.status_code == 422, resp.text

    # Несуществующий проект → 404.
    resp = client.post(
        f"/api/v1/offers/{offer['id']}/project",
        headers=_auth(manager["access_token"]),
        json={"project_id": 999999, "selected_fields": ["name"]},
    )
    assert resp.status_code == 404, resp.text

    # Создатель без approved раскрытия → 409.
    resp = client.post(
        f"/api/v1/offers/{offer['id']}/project",
        headers=_auth(owner["access_token"]),
        json={"selected_fields": ["name"]},
    )
    assert resp.status_code == 409, resp.text

    # Дублирующая связь → 409.
    _link_project(
        client, manager["access_token"], offer["id"], selected_fields=["name"]
    )
    resp = client.post(
        f"/api/v1/offers/{offer['id']}/project",
        headers=_auth(manager["access_token"]),
        json={"selected_fields": ["name"]},
    )
    assert resp.status_code == 409, resp.text

    # Отклонённый оффер связать нельзя → 409.
    executor2 = _register_executor(client)
    offer2 = _make_offer(
        client, manager["access_token"], request_id, executor2["user"]["id"]
    )
    client.post(f"/api/v1/offers/{offer2['id']}/decline", headers=_auth(executor2["access_token"]))
    resp = client.post(
        f"/api/v1/offers/{offer2['id']}/project",
        headers=_auth(manager["access_token"]),
        json={"selected_fields": ["name"]},
    )
    assert resp.status_code == 409, resp.text
