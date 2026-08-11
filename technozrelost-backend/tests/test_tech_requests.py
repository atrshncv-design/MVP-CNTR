"""Тикет 01 requests-matching: черновик технологического запроса.

Покрытие: только верифицированный представитель организации (user_organizations
state='verified' + роль gk_customer) создаёт запрос (иначе 403 с честным
сообщением); черновик видят создатель и Центр (staff), чужой → 404 (IDOR);
PATCH — аудит + версия; submit фиксирует (после — 409); вложения versioned;
валидация (deadline в прошлом → 422); staff-доступ.
"""

from __future__ import annotations

import io
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from tests.support import register_test_user

PDF_BYTES = b"%PDF-1.4\n% sample\n%%EOF\n"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> dict:
    return register_test_user(
        client, email=_email("tr"), full_name="Заказчик Тест", role_slug=role
    )


def _register_manager(client: TestClient) -> dict:
    return register_test_user(
        client, email=_email("mgr"), full_name="Менеджер Центра", role_slug="cntr_manager"
    )


def _create_verified_org(client: TestClient, token: str) -> int:
    """Организация: создание → submit → verify менеджером."""
    response = client.post(
        "/api/v1/orgs", headers=_auth(token), json={"name": "ООО ТехноЗаказчик"}
    )
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


def _payload(org_id: int, **overrides: object) -> dict:
    data: dict[str, object] = {
        "organization_id": org_id,
        "title": "Нужна НИОКР по композитам",
        "requirements": "Разработка технологии производства углепластика",
        "demand": "до 5 контрактов в год",
        "deadline": (datetime.now(UTC) + timedelta(days=60)).isoformat(),
        "budget": 5_000_000,
    }
    data.update(overrides)
    return data


def _create_request(client: TestClient, token: str, org_id: int) -> dict:
    response = client.post(
        "/api/v1/tech-requests", headers=_auth(token), json=_payload(org_id)
    )
    assert response.status_code == 201, response.text
    return response.json()


def _audit_actions(client: TestClient, action: str) -> list[dict]:
    admin = register_test_user(
        client, email=_email("adm"), full_name="Админ", role_slug="cntr_admin"
    )
    response = client.get(
        f"/api/v1/admin/audit?action={action}", headers=_auth(admin["access_token"])
    )
    assert response.status_code == 200, response.text
    return response.json()


# ── Доступ к созданию ────────────────────────────────────────────────────────


def test_create_forbidden_for_unverified_organization(client: TestClient) -> None:
    user = _register(client)
    created = client.post(
        "/api/v1/orgs", headers=_auth(user["access_token"]), json={"name": "ООО Драфт"}
    )
    assert created.status_code == 201, created.text
    org_id = created.json()["id"]  # state=draft, менеджер ещё не проверил

    response = client.post(
        "/api/v1/tech-requests", headers=_auth(user["access_token"]), json=_payload(org_id)
    )
    assert response.status_code == 403, response.text
    assert "верифицированн" in response.json()["detail"]


def test_create_forbidden_for_non_customer_role(client: TestClient) -> None:
    executor = _register(client, role="rd_executor")
    org_id = _create_verified_org(client, executor["access_token"])

    response = client.post(
        "/api/v1/tech-requests",
        headers=_auth(executor["access_token"]),
        json=_payload(org_id),
    )
    assert response.status_code == 403, response.text
    assert "gk_customer" in response.json()["detail"]


def test_create_forbidden_for_non_member(client: TestClient) -> None:
    owner = _register(client)
    org_id = _create_verified_org(client, owner["access_token"])
    outsider = _register(client)  # gk_customer, но не представитель организации

    response = client.post(
        "/api/v1/tech-requests",
        headers=_auth(outsider["access_token"]),
        json=_payload(org_id),
    )
    assert response.status_code == 403, response.text
    assert "представителем" in response.json()["detail"]


def test_create_verified_representative_201(client: TestClient) -> None:
    user = _register(client)
    org_id = _create_verified_org(client, user["access_token"])

    response = client.post(
        "/api/v1/tech-requests", headers=_auth(user["access_token"]), json=_payload(org_id)
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["status"] == "draft"
    assert data["version"] == 1
    assert data["organization_id"] == org_id
    assert data["created_by"] == user["user"]["id"]
    assert data["title"] == "Нужна НИОКР по композитам"

    audit = _audit_actions(client, "tech_request.created")
    assert any(entry["details"].get("request_id") == data["id"] for entry in audit)


# ── Валидация полей ──────────────────────────────────────────────────────────


def test_create_rejects_past_deadline(client: TestClient) -> None:
    user = _register(client)
    org_id = _create_verified_org(client, user["access_token"])
    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()

    response = client.post(
        "/api/v1/tech-requests",
        headers=_auth(user["access_token"]),
        json=_payload(org_id, deadline=past),
    )
    assert response.status_code == 422, response.text


def test_create_rejects_negative_budget(client: TestClient) -> None:
    user = _register(client)
    org_id = _create_verified_org(client, user["access_token"])

    response = client.post(
        "/api/v1/tech-requests",
        headers=_auth(user["access_token"]),
        json=_payload(org_id, budget=-1),
    )
    assert response.status_code == 422, response.text


# ── Видимость и IDOR ─────────────────────────────────────────────────────────


def test_foreign_request_hidden_404(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_request(client, creator["access_token"], org_id)
    outsider = _register(client)

    get_response = client.get(
        f"/api/v1/tech-requests/{request['id']}", headers=_auth(outsider["access_token"])
    )
    assert get_response.status_code == 404, get_response.text

    patch_response = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(outsider["access_token"]),
        json={"title": "Взлом"},
    )
    assert patch_response.status_code == 404, patch_response.text


def test_creator_and_staff_see_request(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_request(client, creator["access_token"], org_id)
    manager = _register_manager(client)

    own_list = client.get("/api/v1/tech-requests", headers=_auth(creator["access_token"]))
    assert own_list.status_code == 200, own_list.text
    assert [item["id"] for item in own_list.json()] == [request["id"]]

    staff_list = client.get("/api/v1/tech-requests", headers=_auth(manager["access_token"]))
    assert staff_list.status_code == 200, staff_list.text
    assert any(item["id"] == request["id"] for item in staff_list.json())

    staff_get = client.get(
        f"/api/v1/tech-requests/{request['id']}", headers=_auth(manager["access_token"])
    )
    assert staff_get.status_code == 200, staff_get.text


def test_other_user_list_excludes_foreign(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    _create_request(client, creator["access_token"], org_id)
    other = _register(client)

    response = client.get("/api/v1/tech-requests", headers=_auth(other["access_token"]))
    assert response.status_code == 200, response.text
    assert response.json() == []


# ── PATCH: версия + аудит ────────────────────────────────────────────────────


def test_patch_bumps_version_and_audits(client: TestClient) -> None:
    user = _register(client)
    org_id = _create_verified_org(client, user["access_token"])
    request = _create_request(client, user["access_token"], org_id)

    response = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(user["access_token"]),
        json={"title": "Нужна НИОКР по композитам (уточнено)", "budget": 7_000_000},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["version"] == 2
    assert data["title"] == "Нужна НИОКР по композитам (уточнено)"
    assert data["budget"] == 7_000_000

    audit = _audit_actions(client, "tech_request.updated")
    entry = next(
        e for e in audit if e["details"].get("request_id") == request["id"]
    )
    assert entry["details"]["version"] == 2
    assert set(entry["details"]["changed"]) == {"budget", "title"}


def test_patch_rejects_past_deadline(client: TestClient) -> None:
    user = _register(client)
    org_id = _create_verified_org(client, user["access_token"])
    request = _create_request(client, user["access_token"], org_id)

    response = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(user["access_token"]),
        json={"deadline": (datetime.now(UTC) - timedelta(days=1)).isoformat()},
    )
    assert response.status_code == 422, response.text

    after = client.get(
        f"/api/v1/tech-requests/{request['id']}", headers=_auth(user["access_token"])
    )
    assert after.json()["version"] == 1  # версия не изменилась


def test_staff_cannot_edit(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_request(client, creator["access_token"], org_id)
    manager = _register_manager(client)

    response = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(manager["access_token"]),
        json={"title": "Правка Центром"},
    )
    assert response.status_code == 403, response.text


# ── Submit: фиксация ─────────────────────────────────────────────────────────


def test_submit_fixes_request(client: TestClient) -> None:
    user = _register(client)
    org_id = _create_verified_org(client, user["access_token"])
    request = _create_request(client, user["access_token"], org_id)

    submitted = client.post(
        f"/api/v1/tech-requests/{request['id']}/submit",
        headers=_auth(user["access_token"]),
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"

    audit = _audit_actions(client, "tech_request.submitted")
    assert any(e["details"].get("request_id") == request["id"] for e in audit)

    patch = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(user["access_token"]),
        json={"title": "Поздняя правка"},
    )
    assert patch.status_code == 409, patch.text

    documents = client.post(
        f"/api/v1/tech-requests/{request['id']}/documents",
        headers=_auth(user["access_token"]),
        data={"title": "ТЗ"},
        files={"file": ("tz.pdf", io.BytesIO(PDF_BYTES), "application/pdf")},
    )
    assert documents.status_code == 409, documents.text

    resubmit = client.post(
        f"/api/v1/tech-requests/{request['id']}/submit",
        headers=_auth(user["access_token"]),
    )
    assert resubmit.status_code == 409, resubmit.text


# ── Вложения versioned ───────────────────────────────────────────────────────


def test_documents_versioned(client: TestClient) -> None:
    user = _register(client)
    org_id = _create_verified_org(client, user["access_token"])
    request = _create_request(client, user["access_token"], org_id)

    first = client.post(
        f"/api/v1/tech-requests/{request['id']}/documents",
        headers=_auth(user["access_token"]),
        data={"title": "Техническое задание"},
        files={"file": ("tz.pdf", io.BytesIO(PDF_BYTES), "application/pdf")},
    )
    assert first.status_code == 201, first.text
    assert first.json()["version"] == 1

    second = client.post(
        f"/api/v1/tech-requests/{request['id']}/documents",
        headers=_auth(user["access_token"]),
        data={"title": "Техническое задание"},
        files={"file": ("tz-v2.pdf", io.BytesIO(PDF_BYTES), "application/pdf")},
    )
    assert second.status_code == 201, second.text
    assert second.json()["version"] == 2

    audit = _audit_actions(client, "tech_request.document_added")
    assert any(e["details"].get("document_id") == second.json()["id"] for e in audit)

    detail = client.get(
        f"/api/v1/tech-requests/{request['id']}", headers=_auth(user["access_token"])
    )
    docs = detail.json()["documents"]
    assert [doc["version"] for doc in docs] == [1, 2]


def test_document_rejects_invalid_file(client: TestClient) -> None:
    user = _register(client)
    org_id = _create_verified_org(client, user["access_token"])
    request = _create_request(client, user["access_token"], org_id)

    response = client.post(
        f"/api/v1/tech-requests/{request['id']}/documents",
        headers=_auth(user["access_token"]),
        data={"title": "Фейк"},
        files={"file": ("fake.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")},
    )
    assert response.status_code == 422, response.text
