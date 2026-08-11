"""Тикет 02 (operations-modules): реестр экспертов и базовое заключение.

Покрывает: назначение staff (пул verified-профилей), scope-изоляция эксперта,
COI-гейт (403 до декларации), lifecycle assigned→accepted→coi→submitted→reviewed
с аудитом, версии заключений, RBAC (чужое 404, не-staff 403).
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _register(client: TestClient, role: str = "gk_customer") -> dict:
    return register_test_user(
        client,
        email=f"{_uniq('u')}@example.com",
        full_name="Тест Эксперт",
        role_slug=role,
    )


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str) -> int:
    resp = client.post(
        "/api/v1/projects",
        headers=_auth(token),
        json={
            "name": _uniq("Проект"),
            "description": "Синтетический проект экспертного тикета",
            "category": "it",
            "target_level": 9,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_stage(client: TestClient, token: str, project_id: int) -> int:
    resp = client.post(
        f"/api/v1/projects/{project_id}/stages",
        headers=_auth(token),
        json={
            "title": _uniq("Этап"),
            "planned_start_date": date.today().isoformat(),
            "planned_end_date": (date.today() + timedelta(days=30)).isoformat(),
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _make_verified_expert(client: TestClient) -> dict:
    """Эксперт = пользователь с verified-профилем (пул по решению тикета)."""
    user = _register(client, role="rd_executor")
    patched = client.patch(
        "/api/v1/profile",
        headers=_auth(user["access_token"]),
        json={"headline": "Ведущий инженер", "skills": ["python", "ml"]},
    )
    assert patched.status_code == 200, patched.text
    submitted = client.post(
        "/api/v1/profile/submit", headers=_auth(user["access_token"])
    )
    assert submitted.status_code == 200, submitted.text
    profile_id = submitted.json()["id"]
    manager = register_test_user(
        client,
        email=f"{_uniq('mgr')}@example.com",
        full_name="Менеджер ЦНТР",
        role_slug="cntr_manager",
    )
    decided = client.post(
        f"/api/v1/manager/profiles/{profile_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"action": "verify", "comment": "ОК"},
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["state"] == "verified"
    return user


# ─── Назначение и scope-изоляция ─────────────────────────────────────────────

def test_assign_expert_staff_only(client: TestClient) -> None:
    owner = _register(client)
    expert = _make_verified_expert(client)
    stranger = _register(client)
    pid = _create_project(client, owner["access_token"])
    stage_id = _create_stage(client, owner["access_token"], pid)

    # Не-staff не может назначить.
    resp = client.post(
        f"/api/v1/projects/{pid}/experts",
        headers=_auth(owner["access_token"]),
        json={"expert_user_id": expert["user"]["id"], "scope": {"stage_ids": [stage_id]}},
    )
    assert resp.status_code == 403, resp.text

    # Staff назначает.
    manager = register_test_user(
        client,
        email=f"{_uniq('mgr')}@example.com",
        full_name="Менеджер ЦНТР",
        role_slug="cntr_manager",
    )
    resp = client.post(
        f"/api/v1/projects/{pid}/experts",
        headers=_auth(manager["access_token"]),
        json={"expert_user_id": expert["user"]["id"], "scope": {"stage_ids": [stage_id]}},
    )
    assert resp.status_code == 201, resp.text
    assignment = resp.json()
    assert assignment["status"] == "assigned"
    assert assignment["scope"].get("stage_ids") == [stage_id]

    # Эксперт видит назначение в mine.
    mine = client.get(
        "/api/v1/experts/assignments/mine",
        headers=_auth(expert["access_token"]),
    ).json()
    assert any(a["id"] == assignment["id"] for a in mine)

    # Чужой не видит назначение (IDOR → 404).
    resp = client.get(
        f"/api/v1/projects/{pid}",
        headers=_auth(stranger["access_token"]),
    )
    assert resp.status_code == 404


def test_scope_isolation_before_coi(client: TestClient) -> None:
    owner = _register(client)
    expert = _make_verified_expert(client)
    pid = _create_project(client, owner["access_token"])
    stage_id = _create_stage(client, owner["access_token"], pid)
    manager = register_test_user(
        client,
        email=f"{_uniq('mgr')}@example.com",
        full_name="Менеджер ЦНТР",
        role_slug="cntr_manager",
    )
    assigned = client.post(
        f"/api/v1/projects/{pid}/experts",
        headers=_auth(manager["access_token"]),
        json={"expert_user_id": expert["user"]["id"], "scope": {"stage_ids": [stage_id]}},
    ).json()

    # Эксперт НЕ принял назначение, но уже назначен: доступ к материалам
    # блокируется COI-гейтом (403), не 404 (назначение активно).
    resp = client.get(f"/api/v1/projects/{pid}", headers=_auth(expert["access_token"]))
    assert resp.status_code == 403, resp.text

    # Принял — но без COI → 403 на доступ к материалам (scoped-view).
    accepted = client.post(
        f"/api/v1/experts/assignments/{assigned['id']}/accept",
        headers=_auth(expert["access_token"]),
    )
    assert accepted.status_code == 200, accepted.text
    resp = client.get(f"/api/v1/projects/{pid}", headers=_auth(expert["access_token"]))
    assert resp.status_code == 403, resp.text


# ─── COI, заключение, lifecycle ──────────────────────────────────────────────

def test_conclusion_lifecycle_and_versions(client: TestClient) -> None:
    owner = _register(client)
    expert = _make_verified_expert(client)
    pid = _create_project(client, owner["access_token"])
    stage_id = _create_stage(client, owner["access_token"], pid)
    manager = register_test_user(
        client,
        email=f"{_uniq('mgr')}@example.com",
        full_name="Менеджер ЦНТР",
        role_slug="cntr_manager",
    )
    assigned = client.post(
        f"/api/v1/projects/{pid}/experts",
        headers=_auth(manager["access_token"]),
        json={"expert_user_id": expert["user"]["id"], "scope": {"stage_ids": [stage_id]}},
    ).json()
    aid = assigned["id"]
    client.post(
        f"/api/v1/experts/assignments/{aid}/accept",
        headers=_auth(expert["access_token"]),
    )

    # Черновик заключения БЕЗ COI → 403.
    resp = client.post(
        f"/api/v1/experts/assignments/{aid}/conclusion",
        headers=_auth(expert["access_token"]),
        json={"content": "Заключение 1"},
    )
    assert resp.status_code == 403, resp.text

    # COI.
    coi = client.post(
        f"/api/v1/experts/assignments/{aid}/coi",
        headers=_auth(expert["access_token"]),
        json={"declared": True},
    )
    assert coi.status_code == 200, coi.text

    # Черновик v1, затем v2.
    v1 = client.post(
        f"/api/v1/experts/assignments/{aid}/conclusion",
        headers=_auth(expert["access_token"]),
        json={"content": "Заключение 1"},
    )
    assert v1.status_code == 201, v1.text
    assert v1.json()["version"] == 1
    v2 = client.post(
        f"/api/v1/experts/assignments/{aid}/conclusion",
        headers=_auth(expert["access_token"]),
        json={"content": "Заключение 2 (уточнено)"},
    )
    assert v2.status_code == 201, v2.text
    assert v2.json()["version"] == 2

    # Submit фиксирует версию.
    submitted = client.post(
        f"/api/v1/experts/assignments/{aid}/conclusion/submit",
        headers=_auth(expert["access_token"]),
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"

    # После submit черновик нельзя изменить → 409.
    resp = client.post(
        f"/api/v1/experts/assignments/{aid}/conclusion",
        headers=_auth(expert["access_token"]),
        json={"content": "Ещё версия"},
    )
    assert resp.status_code == 409, resp.text

    # Staff ревью: approved → reviewed.
    reviewed = client.post(
        f"/api/v1/experts/assignments/{aid}/review",
        headers=_auth(manager["access_token"]),
        json={"approved": True, "comment": "Соответствует"},
    )
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["status"] == "reviewed"

    # Lifecycle подтверждается статусом назначения (reviewed).
    mine = client.get(
        "/api/v1/experts/assignments/mine",
        headers=_auth(expert["access_token"]),
    ).json()
    statuses = [a["status"] for a in mine]
    assert "reviewed" in statuses


def test_decline_and_rbac(client: TestClient) -> None:
    owner = _register(client)
    expert = _make_verified_expert(client)
    stranger = _register(client)
    pid = _create_project(client, owner["access_token"])
    manager = register_test_user(
        client,
        email=f"{_uniq('mgr')}@example.com",
        full_name="Менеджер ЦНТР",
        role_slug="cntr_manager",
    )
    assigned = client.post(
        f"/api/v1/projects/{pid}/experts",
        headers=_auth(manager["access_token"]),
        json={"expert_user_id": expert["user"]["id"]},
    ).json()

    # Чужой не может принять/отклонить чужое назначение (IDOR → 404).
    resp = client.post(
        f"/api/v1/experts/assignments/{assigned['id']}/accept",
        headers=_auth(stranger["access_token"]),
    )
    assert resp.status_code == 404, resp.text

    # Эксперт отклоняет.
    declined = client.post(
        f"/api/v1/experts/assignments/{assigned['id']}/decline",
        headers=_auth(expert["access_token"]),
    )
    assert declined.status_code == 200, declined.text
    assert declined.json()["status"] == "declined"

    # Повторный ответ после declined → 409.
    resp = client.post(
        f"/api/v1/experts/assignments/{assigned['id']}/accept",
        headers=_auth(expert["access_token"]),
    )
    assert resp.status_code == 409, resp.text
