"""Smoke tests: auth round-trip against the isolated test database."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def _unique_email() -> str:
    return f"smoke-{uuid.uuid4().hex[:10]}@example.com"


def test_health_liveness(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ready_readiness_against_test_db(client: TestClient) -> None:
    response = client.get("/api/v1/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["databases"]["primary"] == "ok"


def test_register_login_me_roundtrip(client: TestClient) -> None:
    email = _unique_email()
    password = "Probe12345"

    register = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Smoke Test User",
            "organization": "Тестовая организация",
            "role_slug": "gk_customer",
        },
    )
    assert register.status_code == 201, register.text
    token = register.json()["access_token"]
    assert len(token) > 50
    assert register.json()["user"]["roles"][0]["slug"] == "gk_customer"

    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    login_token = login.json()["access_token"]
    assert login_token  # JWT contains exp (second precision) — tokens may differ

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login_token}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["full_name"] == "Smoke Test User"


def test_login_wrong_password_rejected(client: TestClient) -> None:
    email = _unique_email()
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": "Wrong Pass",
            "role_slug": "rd_executor",
        },
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPass99"},
    )
    assert login.status_code == 401


def test_duplicate_email_conflict(client: TestClient) -> None:
    email = _unique_email()
    payload = {
        "email": email,
        "password": "Probe12345",
        "full_name": "Dup",
        "role_slug": "investor",
    }
    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409


def test_unknown_role_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": _unique_email(),
            "password": "Probe12345",
            "full_name": "Bad Role",
            "role_slug": "not_a_role",
        },
    )
    assert response.status_code == 400
