"""Тикет 27/28 (mvp1-release): история заявок на повышение УГТ для участника.

GET /projects/{id}/promotion-history — владелец/участник/ЦНТР; чужие → 404 (IDOR).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str) -> int:
    resp = client.post(
        "/api/v1/projects",
        headers=_auth(token),
        json={
            "name": _uniq("Проект"),
            "description": "Тест истории",
            "category": "it",
            "target_level": 7,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_promotion_history_owner_and_rbac(client: TestClient) -> None:
    owner = register_test_user(
        client,
        email=f"{_uniq('u')}@example.com",
        full_name="Владелец",
        role_slug="gk_customer",
    )
    stranger = register_test_user(
        client,
        email=f"{_uniq('s')}@example.com",
        full_name="Чужой",
        role_slug="gk_customer",
    )
    pid = _create_project(client, owner["access_token"])

    # Владелец: пустая история — 200, список.
    resp = client.get(
        f"/api/v1/projects/{pid}/promotion-history",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == []

    # Чужой → 404 (IDOR-маскировка).
    resp = client.get(
        f"/api/v1/projects/{pid}/promotion-history",
        headers=_auth(stranger["access_token"]),
    )
    assert resp.status_code == 404, resp.text

    # Аноним → 401.
    resp = client.get(f"/api/v1/projects/{pid}/promotion-history")
    assert resp.status_code == 401, resp.text
