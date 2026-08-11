"""Тикет 04 Friday RC: приглашения, project_admin, договорные поля.

Покрытие: создатель получает project_admin и может передать полномочие;
одноразовые приглашения (срок, допустимые роли, однократность); массовые
(лимит и отзыв); проектная роль независима от основной; договорные поля
меняет только менеджер; отрицательные RBAC/IDOR тесты.
"""

from __future__ import annotations

import uuid

import psycopg
from fastapi.testclient import TestClient

from tests.support import register_test_user

PASSWORD = "Probe12345"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(client, email=_email("inv"), full_name="Участник", role_slug=role)
    return data["access_token"], data["user"]["id"]


def _register_manager(client: TestClient) -> str:
    data = register_test_user(
        client, email=_email("mgr"), full_name="Менеджер", role_slug="cntr_manager"
    )
    return data["access_token"]


def _create_project(client: TestClient, token: str) -> int:
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(token),
        json={
            "name": "Проект-приглашение",
            "questionnaire_results": [
                {"level_id": 1, "checked_items": ["Идея"], "percentage": 100.0},
                {"level_id": 2, "checked_items": [], "percentage": 0.0},
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _set_expired(dbname: str, invite_id: int) -> None:
    conn = psycopg.connect(
        host="127.0.0.1", port=5432, user="technoz", password="change_me", dbname=dbname,
        autocommit=True,
    )
    try:
        conn.execute(
            "UPDATE public.project_invites SET expires_at = now() - interval '1 hour' "
            "WHERE id = %s",
            (invite_id,),
        )
    finally:
        conn.close()


# ── project_admin ─────────────────────────────────────────────────────────────


def test_creator_gets_project_admin_and_can_create_invite(client: TestClient) -> None:
    owner_token, _ = _register(client)
    project_id = _create_project(client, owner_token)

    response = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(owner_token),
        json={"invite_type": "single", "allowed_roles": ["participant"]},
    )
    assert response.status_code == 201, response.text
    assert response.json()["invite_type"] == "single"
    assert len(response.json()["token"]) >= 20


def test_transfer_admin_moves_privilege(client: TestClient) -> None:
    owner_token, _ = _register(client)
    member_token, member_id = _register(client, "rd_executor")
    outsider_token, _ = _register(client, "scientific_org")
    project_id = _create_project(client, owner_token)

    # участник вступает по одноразовому приглашению
    invite = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(owner_token),
        json={"invite_type": "single", "allowed_roles": ["participant", "tech_lead"]},
    ).json()
    accepted = client.post(
        "/api/v1/invites/accept",
        headers=_auth(member_token),
        json={"token": invite["token"], "role_in_project": "tech_lead"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["role_in_project"] == "tech_lead"

    # передача админки участнику
    transferred = client.post(
        f"/api/v1/projects/{project_id}/transfer-admin",
        headers=_auth(owner_token),
        json={"user_id": member_id},
    )
    assert transferred.status_code == 200
    assert transferred.json()["admin_user_id"] == member_id

    # новый админ создаёт приглашение
    ok = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(member_token),
        json={"invite_type": "single"},
    )
    assert ok.status_code == 201

    # бывший админ — больше нет; посторонний — 404 (не участник)
    denied = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(owner_token),
        json={"invite_type": "single"},
    )
    assert denied.status_code == 403
    outsider = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(outsider_token),
        json={"invite_type": "single"},
    )
    assert outsider.status_code == 404


# ── Приглашения ───────────────────────────────────────────────────────────────


def test_single_invite_single_use_and_role_restriction(client: TestClient) -> None:
    owner_token, _ = _register(client)
    alice_token, _ = _register(client, "rd_executor")
    bob_token, _ = _register(client, "rd_executor")
    project_id = _create_project(client, owner_token)

    invite = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(owner_token),
        json={"invite_type": "single", "allowed_roles": ["participant"]},
    ).json()

    # роль не из списка — 403
    wrong_role = client.post(
        "/api/v1/invites/accept",
        headers=_auth(alice_token),
        json={"token": invite["token"], "role_in_project": "tech_lead"},
    )
    assert wrong_role.status_code == 403

    # правильная роль — вступление
    ok = client.post(
        "/api/v1/invites/accept",
        headers=_auth(alice_token),
        json={"token": invite["token"], "role_in_project": "participant"},
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "active"

    # одноразовый токен исчерпан — второй участник не может войти
    exhausted = client.post(
        "/api/v1/invites/accept",
        headers=_auth(bob_token),
        json={"token": invite["token"], "role_in_project": "participant"},
    )
    assert exhausted.status_code == 409


def test_bulk_invite_limit_and_revoke(client: TestClient) -> None:
    owner_token, _ = _register(client)
    alice_token, _ = _register(client, "rd_executor")
    bob_token, _ = _register(client, "rd_executor")
    carol_token, _ = _register(client, "rd_executor")
    project_id = _create_project(client, owner_token)

    invite = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(owner_token),
        json={"invite_type": "bulk", "max_uses": 2, "allowed_roles": ["participant"]},
    ).json()
    assert invite["max_uses"] == 2

    assert client.post(
        "/api/v1/invites/accept",
        headers=_auth(alice_token),
        json={"token": invite["token"], "role_in_project": "participant"},
    ).status_code == 200
    assert client.post(
        "/api/v1/invites/accept",
        headers=_auth(bob_token),
        json={"token": invite["token"], "role_in_project": "participant"},
    ).status_code == 200
    # лимит исчерпан
    assert client.post(
        "/api/v1/invites/accept",
        headers=_auth(carol_token),
        json={"token": invite["token"], "role_in_project": "participant"},
    ).status_code == 409

    # отзыв массового приглашения — новый участник больше не может войти
    invite_id = invite["id"]
    revoked = client.post(
        f"/api/v1/projects/{project_id}/invites/{invite_id}/revoke",
        headers=_auth(owner_token),
    )
    assert revoked.status_code == 200
    assert revoked.json()["revoked_at"] is not None

    dave_token, _ = _register(client, "rd_executor")
    assert client.post(
        "/api/v1/invites/accept",
        headers=_auth(dave_token),
        json={"token": invite["token"], "role_in_project": "participant"},
    ).status_code == 409


def test_invite_expired(client: TestClient) -> None:
    owner_token, _ = _register(client)
    alice_token, _ = _register(client, "rd_executor")
    project_id = _create_project(client, owner_token)

    invite = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(owner_token),
        json={"invite_type": "single", "expires_in_hours": 1},
    ).json()
    _set_expired("technozrelost_test", invite["id"])

    response = client.post(
        "/api/v1/invites/accept",
        headers=_auth(alice_token),
        json={"token": invite["token"], "role_in_project": "participant"},
    )
    assert response.status_code == 409


def test_invite_rbac_non_admin_cannot_manage(client: TestClient) -> None:
    owner_token, _ = _register(client)
    member_token, _ = _register(client, "rd_executor")
    project_id = _create_project(client, owner_token)

    invite = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(owner_token),
        json={"invite_type": "bulk", "max_uses": 5},
    ).json()
    client.post(
        "/api/v1/invites/accept",
        headers=_auth(member_token),
        json={"token": invite["token"], "role_in_project": "participant"},
    )

    # обычный участник не может создавать/отзывать приглашения
    denied = client.post(
        f"/api/v1/projects/{project_id}/invites",
        headers=_auth(member_token),
        json={"invite_type": "single"},
    )
    assert denied.status_code == 403
    revoke = client.post(
        f"/api/v1/projects/{project_id}/invites/{invite['id']}/revoke",
        headers=_auth(member_token),
    )
    assert revoke.status_code == 403


# ── Договорные поля ───────────────────────────────────────────────────────────


def test_legal_fields_only_manager(client: TestClient) -> None:
    owner_token, _ = _register(client)
    manager_token = _register_manager(client)
    project_id = _create_project(client, owner_token)

    # пользователь — 403
    denied = client.patch(
        f"/api/v1/projects/{project_id}/legal",
        headers=_auth(owner_token),
        json={"legal_owner": "ООО Владелец", "contract_number": "Д-2026/01"},
    )
    assert denied.status_code == 403

    # менеджер — 200
    ok = client.patch(
        f"/api/v1/projects/{project_id}/legal",
        headers=_auth(manager_token),
        json={
            "legal_owner": "ООО Владелец",
            "rights_holder": "АО Правообладатель",
            "contract_number": "Д-2026/01",
            "contract_basis": "Договор №Д-2026/01 от 01.02.2026",
        },
    )
    assert ok.status_code == 200
    assert ok.json()["legal_owner"] == "ООО Владелец"
    assert ok.json()["contract_number"] == "Д-2026/01"
    assert ok.json()["legal_updated_by"] is not None
