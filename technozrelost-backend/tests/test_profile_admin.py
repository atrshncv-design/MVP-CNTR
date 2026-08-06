"""Профиль (редактирование, смена пароля) и администрирование пользователей."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    email = f"prof-{uuid.uuid4().hex[:8]}@example.com"
    data = register_test_user(
        client,
        email=email,
        full_name="Profile User",
        organization="Орг А",
        role_slug=role,
    )
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_update_profile(client: TestClient) -> None:
    token, _ = _register(client)
    response = client.patch(
        "/api/v1/users/me",
        json={"full_name": "Новое Имя", "organization": "Орг Б"},
        headers=_auth(token),
    )
    assert response.status_code == 200, response.text
    assert response.json()["full_name"] == "Новое Имя"
    assert response.json()["organization"] == "Орг Б"


def test_change_password(client: TestClient) -> None:
    token, _ = _register(client)

    wrong = client.post(
        "/api/v1/users/me/password",
        json={"old_password": "WrongOld99", "new_password": "NewPass12345"},
        headers=_auth(token),
    )
    assert wrong.status_code == 401

    ok = client.post(
        "/api/v1/users/me/password",
        json={"old_password": "Probe12345", "new_password": "NewPass12345"},
        headers=_auth(token),
    )
    assert ok.status_code == 204

    login = client.post(
        "/api/v1/auth/login",
        json={"email": None, "password": "NewPass12345"},
    )
    # email неизвестен — проверим через полный цикл ниже
    assert login.status_code == 422  # email отсутствует


def test_login_with_new_password(client: TestClient) -> None:
    token, _ = _register(client)
    client.post(
        "/api/v1/users/me/password",
        json={"old_password": "Probe12345", "new_password": "NewPass12345"},
        headers=_auth(token),
    )
    # получаем email через /me
    me = client.get("/api/v1/auth/me", headers=_auth(token))
    email = me.json()["email"]

    old = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Probe12345"}
    )
    assert old.status_code == 401

    new = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "NewPass12345"}
    )
    assert new.status_code == 200


def test_list_users_requires_admin(client: TestClient) -> None:
    user_token, _ = _register(client)
    denied = client.get("/api/v1/users", headers=_auth(user_token))
    assert denied.status_code == 403

    admin_token, _ = _register(client, "cntr_admin")
    allowed = client.get("/api/v1/users", headers=_auth(admin_token))
    assert allowed.status_code == 200
    assert len(allowed.json()) >= 2


def test_admin_updates_roles_and_deactivates(client: TestClient) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    user_token, user_id = _register(client, "gk_customer")

    updated = client.patch(
        f"/api/v1/users/{user_id}",
        json={"roles": ["gk_customer", "rd_executor"]},
        headers=_auth(admin_token),
    )
    assert updated.status_code == 200
    slugs = [r["slug"] for r in updated.json()["roles"]]
    assert "rd_executor" in slugs

    # деактивация → логин запрещён
    client.patch(
        f"/api/v1/users/{user_id}",
        json={"is_active": False},
        headers=_auth(admin_token),
    )
    email = updated.json()["email"]
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Probe12345"})
    assert login.status_code == 403


def test_admin_unknown_role_rejected(client: TestClient) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    _, user_id = _register(client)
    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={"roles": ["not_a_role"]},
        headers=_auth(admin_token),
    )
    assert response.status_code == 400
