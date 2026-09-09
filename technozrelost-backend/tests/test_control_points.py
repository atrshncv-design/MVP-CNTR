"""Контрольные точки: авто-создание при проекте, решения эксперта/аудитора."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import priority_share_sig, register_test_user


def _register(client: TestClient, role: str = "gk_customer") -> str:
    # R04i (таск 03): привилегированные роли (auditor/regulating_organization)
    # выдаёт только администратор — provision через tests.support (БД-зеркало
    # PATCH /users/{id}), непривилегированные — как раньше через HTTP.
    email = f"cp-{uuid.uuid4().hex[:8]}@example.com"
    data = register_test_user(
        client, email=email, full_name=f"CP {role}", role_slug=role
    )
    return data["access_token"]


def _join_as_active(
    client: TestClient, owner_token: str, project_id: int, member_token: str,
    role_in_project: str,
) -> None:
    detail = client.get(
        f"/api/v1/projects/{project_id}", headers=_auth(owner_token)
    )
    assert detail.status_code == 200, detail.text
    join_token = detail.json()["project"]["join_token"]
    joined = client.post(
        "/api/v1/projects/join",
        json={
            "token": join_token,
            "role_in_project": role_in_project,
            "share_sig": priority_share_sig(client, owner_token, project_id),
        },
        headers=_auth(member_token),
    )
    assert joined.status_code == 200, joined.text
    assert joined.json()["status"] == "active"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str) -> int:
    response = client.post(
        "/api/v1/projects",
        json={"name": "КТ-проект", "target_level": 5},
        headers=_auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_project_creation_seeds_control_points(client: TestClient) -> None:
    owner_token = _register(client)
    project_id = _create_project(client, owner_token)

    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    assert detail.status_code == 200
    points = detail.json()["control_points"]
    assert len(points) == 4
    assert any("КТ-1" in p["title"] for p in points)
    assert all(p["status"] == "pending" for p in points)
    assert points[0]["point_type"] == "gate"  # КТ-1 — ворота


def test_expert_can_decide_control_point(client: TestClient) -> None:
    owner_token = _register(client)
    expert_token = _register(client, "regulating_organization")
    project_id = _create_project(client, owner_token)
    # R04i: верификатор решает только назначенный проект (активное участие).
    _join_as_active(
        client, owner_token, project_id, expert_token, "regulating_organization"
    )

    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    cp = detail.json()["control_points"][0]

    decided = client.patch(
        f"/api/v1/projects/{project_id}/control-points/{cp['id']}",
        json={"status": "approved", "decision": "Критерии УГТ подтверждены"},
        headers=_auth(expert_token),
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["status"] == "approved"
    assert decided.json()["decision"] == "Критерии УГТ подтверждены"
    assert decided.json()["decided_by"] is not None

    # аудит зафиксирован
    detail2 = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    actions = [a["action"] for a in detail2.json()["audit_trail"]]
    assert "control_point.approved" in actions


def test_regular_user_cannot_decide_control_point(client: TestClient) -> None:
    owner_token = _register(client)
    rd_token = _register(client, "rd_executor")
    project_id = _create_project(client, owner_token)

    # R&D вступает в проект по приоритетной ссылке владельца → активный участник
    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    join_token = detail.json()["project"]["join_token"]
    joined = client.post(
        "/api/v1/projects/join",
        json={
            "token": join_token,
            "role_in_project": "rd_executor",
            "share_sig": priority_share_sig(client, owner_token, project_id),
        },
        headers=_auth(rd_token),
    )
    assert joined.status_code == 200
    assert joined.json()["status"] == "active"

    cp = detail.json()["control_points"][0]
    denied = client.patch(
        f"/api/v1/projects/{project_id}/control-points/{cp['id']}",
        json={"status": "approved"},
        headers=_auth(rd_token),
    )
    assert denied.status_code == 403


def test_auditor_go_no_go_on_kt1(client: TestClient) -> None:
    owner_token = _register(client)
    auditor_token = _register(client, "auditor")
    project_id = _create_project(client, owner_token)
    # R04i: аудитор решает только назначенный проект (активное участие).
    _join_as_active(client, owner_token, project_id, auditor_token, "auditor")

    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    kt1 = next(p for p in detail.json()["control_points"] if "КТ-1" in p["title"])

    decided = client.patch(
        f"/api/v1/projects/{project_id}/control-points/{kt1['id']}",
        json={"status": "rejected", "decision": "ТЭО не обосновано"},
        headers=_auth(auditor_token),
    )
    assert decided.status_code == 200
    assert decided.json()["status"] == "rejected"
    assert decided.json()["decision"] == "ТЭО не обосновано"
