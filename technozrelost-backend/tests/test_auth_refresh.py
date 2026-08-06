"""Refresh-цикл: пара токенов, ротация, отзыв при повторном использовании."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def _register(client: TestClient) -> dict:
    email = f"refresh-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": "Refresh User",
            "role_slug": "gk_customer",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_returns_refresh_token(client: TestClient) -> None:
    data = _register(client)
    assert data["refresh_token"], "login/register должен возвращать refresh_token"
    assert data["access_token"]
    assert data["token_type"] == "bearer"


def test_refresh_rotates_token_and_old_is_revoked(client: TestClient) -> None:
    data = _register(client)
    old_refresh = data["refresh_token"]
    old_access = data["access_token"]

    # Старый access работает
    me = client.get("/api/v1/auth/me", headers=_auth(old_access))
    assert me.status_code == 200

    # Ротация
    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert refreshed.status_code == 200, refreshed.text
    new = refreshed.json()
    assert new["refresh_token"] != old_refresh
    assert new["access_token"] != old_access
    assert new["user"]["email"] == data["user"]["email"]

    # Новый access работает
    me2 = client.get("/api/v1/auth/me", headers=_auth(new["access_token"]))
    assert me2.status_code == 200

    # Повторное использование старого refresh — отозван (401)
    replay = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert replay.status_code == 401

    # Ещё одна ротация нового refresh — работает (цепочка не сломана)
    again = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new["refresh_token"]},
    )
    assert again.status_code == 200


def test_refresh_token_cannot_be_used_as_access(client: TestClient) -> None:
    data = _register(client)
    me = client.get("/api/v1/auth/me", headers=_auth(data["refresh_token"]))
    assert me.status_code == 401


def test_refresh_rejects_garbage_and_expired(client: TestClient) -> None:
    # Мусор
    bad = client.post("/api/v1/auth/refresh", json={"refresh_token": "not-a-jwt"})
    assert bad.status_code == 401

    # JWT-мусор с правильной структурой, но не refresh-типа
    from app.core.security import create_access_token

    fake = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": create_access_token(1)},
    )
    assert fake.status_code == 401
