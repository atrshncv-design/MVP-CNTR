"""Механика вступления по join-токену: авто-вступление, заявки, приоритет, регенерация."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    email = f"join-{uuid.uuid4().hex[:8]}@example.com"
    data = register_test_user(
        client,
        email=email,
        full_name=f"Join User {role}",
        role_slug=role,
    )
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str) -> dict:
    response = client.post(
        "/api/v1/projects",
        json={"name": "Join Test Project", "target_level": 6},
        headers=_auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_manual_token_entry_creates_pending_request(client: TestClient) -> None:
    owner_token, owner_id = _register(client)
    member_token, _ = _register(client, "rd_executor")
    project = _create_project(client, owner_token)

    # ручной ввод токена (shared_by=None) → заявка
    join = client.post(
        "/api/v1/projects/join",
        json={"token": project["join_token"], "role_in_project": "rd_executor"},
        headers=_auth(member_token),
    )
    assert join.status_code == 200, join.text
    assert join.json()["status"] == "pending"

    # заявка видна владельцу
    requests = client.get(
        f"/api/v1/projects/{project['id']}/join-requests", headers=_auth(owner_token)
    )
    assert requests.status_code == 200
    assert len(requests.json()) == 1
    assert requests.json()[0]["status"] == "pending"
    assert requests.json()[0]["role_in_project"] == "rd_executor"

    # пока заявка pending — доступа к проекту нет
    detail = client.get(f"/api/v1/projects/{project['id']}", headers=_auth(member_token))
    assert detail.status_code == 404


def test_owner_approves_request(client: TestClient) -> None:
    owner_token, _ = _register(client)
    member_token, member_id = _register(client, "rd_executor")
    project = _create_project(client, owner_token)

    client.post(
        "/api/v1/projects/join",
        json={"token": project["join_token"], "role_in_project": "rd_executor"},
        headers=_auth(member_token),
    )
    request_id = client.get(
        f"/api/v1/projects/{project['id']}/join-requests", headers=_auth(owner_token)
    ).json()[0]["id"]

    # одобрение со сменой роли
    decide = client.post(
        f"/api/v1/projects/{project['id']}/join-requests/{request_id}/decide",
        json={"approve": True, "role_in_project": "scientific_org"},
        headers=_auth(owner_token),
    )
    assert decide.status_code == 200
    assert decide.json()["status"] == "active"
    assert decide.json()["role_in_project"] == "scientific_org"

    # теперь участник видит проект
    detail = client.get(f"/api/v1/projects/{project['id']}", headers=_auth(member_token))
    assert detail.status_code == 200


def test_priority_share_auto_joins(client: TestClient) -> None:
    owner_token, owner_id = _register(client)
    member_token, _ = _register(client, "rd_executor")
    project = _create_project(client, owner_token)

    # владелец поделился ссылкой → shared_by=owner → авто-вступление
    join = client.post(
        "/api/v1/projects/join",
        json={
            "token": project["join_token"],
            "role_in_project": "rd_executor",
            "shared_by": owner_id,
        },
        headers=_auth(member_token),
    )
    assert join.status_code == 200
    assert join.json()["status"] == "active"

    detail = client.get(f"/api/v1/projects/{project['id']}", headers=_auth(member_token))
    assert detail.status_code == 200


def test_non_priority_share_stays_pending(client: TestClient) -> None:
    owner_token, owner_id = _register(client)
    member_token, member_id = _register(client, "rd_executor")
    newbie_token, _ = _register(client, "scientific_org")
    project = _create_project(client, owner_token)

    # участник вступает по приоритетной ссылке владельца → активен (без приоритета)
    client.post(
        "/api/v1/projects/join",
        json={
            "token": project["join_token"],
            "role_in_project": "rd_executor",
            "shared_by": owner_id,
        },
        headers=_auth(member_token),
    )

    # новый пользователь вступает по ссылке НЕприоритетного участника → заявка pending
    second_join = client.post(
        "/api/v1/projects/join",
        json={
            "token": project["join_token"],
            "role_in_project": "scientific_org",
            "shared_by": member_id,
        },
        headers=_auth(newbie_token),
    )
    assert second_join.status_code == 200
    assert second_join.json()["status"] == "pending"


def test_reject_sets_removed(client: TestClient) -> None:
    owner_token, _ = _register(client)
    member_token, _ = _register(client, "investor")
    project = _create_project(client, owner_token)

    client.post(
        "/api/v1/projects/join",
        json={"token": project["join_token"], "role_in_project": "investor"},
        headers=_auth(member_token),
    )
    request_id = client.get(
        f"/api/v1/projects/{project['id']}/join-requests", headers=_auth(owner_token)
    ).json()[0]["id"]

    decide = client.post(
        f"/api/v1/projects/{project['id']}/join-requests/{request_id}/decide",
        json={"approve": False},
        headers=_auth(owner_token),
    )
    assert decide.status_code == 200
    assert decide.json()["status"] == "removed"

    # повторная заявка отклоняется
    again = client.post(
        "/api/v1/projects/join",
        json={"token": project["join_token"], "role_in_project": "investor"},
        headers=_auth(member_token),
    )
    assert again.status_code == 409


def test_regenerate_token_invalidates_old(client: TestClient) -> None:
    owner_token, _ = _register(client)
    member_token, _ = _register(client, "rd_executor")
    project = _create_project(client, owner_token)
    old_token = project["join_token"]

    regenerated = client.post(
        f"/api/v1/projects/{project['id']}/regenerate-token", headers=_auth(owner_token)
    )
    assert regenerated.status_code == 200
    new_token = regenerated.json()["join_token"]
    assert new_token != old_token
    assert new_token.startswith("TZ-")

    join_old = client.post(
        "/api/v1/projects/join",
        json={"token": old_token, "role_in_project": "rd_executor"},
        headers=_auth(member_token),
    )
    assert join_old.status_code == 404

    join_new = client.post(
        "/api/v1/projects/join",
        json={"token": new_token, "role_in_project": "rd_executor"},
        headers=_auth(member_token),
    )
    assert join_new.status_code == 200


def test_invalid_token_rejected(client: TestClient) -> None:
    token, _ = _register(client)
    response = client.post(
        "/api/v1/projects/join",
        json={"token": "TZ-AAAAAA", "role_in_project": "rd_executor"},
        headers=_auth(token),
    )
    assert response.status_code == 404


def test_manager_grants_priority(client: TestClient) -> None:
    owner_token, owner_id = _register(client)
    member_token, member_id = _register(client, "rd_executor")
    manager_token, _ = _register(client, "cntr_manager")
    project = _create_project(client, owner_token)

    # участник вступает по ссылке владельца → активен
    client.post(
        "/api/v1/projects/join",
        json={
            "token": project["join_token"],
            "role_in_project": "rd_executor",
            "shared_by": owner_id,
        },
        headers=_auth(member_token),
    )

    # менеджер выдаёт приоритет участнику
    grant = client.patch(
        f"/api/v1/projects/{project['id']}/members/{member_id}/priority",
        json={"is_priority": True},
        headers=_auth(manager_token),
    )
    assert grant.status_code == 200
    assert grant.json()["is_priority"] is True

    # теперь участник с приоритетом может авто-принять нового вступающего
    newbie_token, _ = _register(client, "scientific_org")
    auto = client.post(
        "/api/v1/projects/join",
        json={
            "token": project["join_token"],
            "role_in_project": "scientific_org",
            "shared_by": member_id,
        },
        headers=_auth(newbie_token),
    )
    assert auto.status_code == 200
    assert auto.json()["status"] == "active"


def test_non_manager_cannot_grant_priority(client: TestClient) -> None:
    owner_token, owner_id = _register(client)
    member_token, member_id = _register(client, "rd_executor")
    project = _create_project(client, owner_token)
    client.post(
        "/api/v1/projects/join",
        json={
            "token": project["join_token"],
            "role_in_project": "rd_executor",
            "shared_by": owner_id,
        },
        headers=_auth(member_token),
    )

    denied = client.patch(
        f"/api/v1/projects/{project['id']}/members/{member_id}/priority",
        json={"is_priority": True},
        headers=_auth(owner_token),
    )
    assert denied.status_code == 403
