"""G46/G39 (таск 03, волна 1): персонал выдаёт привилегии и сбрасывает пароль.

Шов — публичная HTTP-граница API. Красный первым: ручного сброса пароля
персоналом и выдачи привилегий менеджером в коде пока нет.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _provision(client: TestClient, role: str, prefix: str) -> tuple[str, int, str]:
    data = register_test_user(
        client, email=_email(prefix), full_name=f"Staff {role}", role_slug=role
    )
    me = client.get("/api/v1/auth/me", headers=_auth(data["access_token"]))
    return data["access_token"], data["user"]["id"], me.json()["email"]


def test_manager_assigns_non_admin_privileged_role(client: TestClient) -> None:
    """G46: менеджер выдаёт непривилегированную выдачу (investor) — 200."""
    manager_token, _, _ = _provision(client, "cntr_manager", "mgr")
    _, target_id, _ = _provision(client, "gk_customer", "tgt")
    updated = client.patch(
        f"/api/v1/users/{target_id}",
        json={"roles": ["investor"]},
        headers=_auth(manager_token),
    )
    assert updated.status_code == 200, updated.text
    assert [r["slug"] for r in updated.json()["roles"]] == ["investor"]


def test_staff_resets_password_manually(client: TestClient) -> None:
    """G39: персонал сбрасывает пароль вручную — старый умирает, аудит пишется."""
    admin_token, _, _ = _provision(client, "cntr_admin", "adm")
    _, target_id, target_email = _provision(client, "gk_customer", "tgt")
    reset = client.post(
        f"/api/v1/users/{target_id}/reset-password",
        json={"new_password": "ManualReset99"},
        headers=_auth(admin_token),
    )
    assert reset.status_code == 200, reset.text
    old = client.post(
        "/api/v1/auth/login",
        json={"email": target_email, "password": "Probe12345"},
    )
    assert old.status_code == 401, old.text
    new = client.post(
        "/api/v1/auth/login",
        json={"email": target_email, "password": "ManualReset99"},
    )
    assert new.status_code == 200, new.text
    audit = client.get(
        "/api/v1/admin/audit",
        params={"action": "user.password.reset"},
        headers=_auth(admin_token),
    )
    assert audit.status_code == 200, audit.text
    assert any(
        e["details"].get("target_user_id") == target_id for e in audit.json()
    ), audit.text


@pytest.mark.parametrize(
    "role",
    ["auditor", "regulating_organization", "investor", "cntr_admin", "cntr_manager"],
)
def test_self_register_privileged_forbidden(client: TestClient, role: str) -> None:
    """G11.1: саморегистрация привилегированной роли — 403 с понятным кодом."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": _email("selfreg"),
            "password": "Probe12345",
            "full_name": f"User {role}",
            "role_slug": role,
        },
    )
    assert response.status_code == 403, response.text
    assert response.headers.get("X-Error-Code") == "AUTH_PRIVILEGED_ROLE_FORBIDDEN"


def test_self_register_legacy_alias_unknown(client: TestClient) -> None:
    """G11.1: алиаса ugt_expert нет в БД — 400, лазейки через старое имя нет."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": _email("selfreg"),
            "password": "Probe12345",
            "full_name": "User alias",
            "role_slug": "ugt_expert",
        },
    )
    assert response.status_code == 400, response.text
    assert response.headers.get("X-Error-Code") == "AUTH_UNKNOWN_ROLE"


def test_role_boundaries_staff_only(client: TestClient) -> None:
    """G10/G46: базовым ролям закрыты персонал-зоны; менеджер не выдаёт cntr_admin."""
    basic_token, basic_id = _provision(client, "gk_customer", "basic")[:2]
    manager_token, _, _ = _provision(client, "cntr_manager", "mgr")
    admin_token, _, _ = _provision(client, "cntr_admin", "adm")

    for method, url, payload in [
        ("GET", "/api/v1/admin/audit", None),
        ("GET", "/api/v1/manager/queue/drafts", None),
        ("GET", "/api/v1/users", None),
        ("PATCH", f"/api/v1/users/{basic_id}", {"roles": ["investor"]}),
        ("POST", f"/api/v1/users/{basic_id}/reset-password", {"new_password": "Xx12345678"}),
    ]:
        denied = client.request(method, url, json=payload, headers=_auth(basic_token))
        assert denied.status_code == 403, (method, url, denied.text)

    # Менеджер видит пользователей и выдаёт не-админские привилегии…
    listed = client.get("/api/v1/users?limit=1", headers=_auth(manager_token))
    assert listed.status_code == 200, listed.text
    # …но роль cntr_admin выдаёт только cntr_admin.
    grant_admin = client.patch(
        f"/api/v1/users/{basic_id}",
        json={"roles": ["cntr_admin"]},
        headers=_auth(manager_token),
    )
    assert grant_admin.status_code == 403, grant_admin.text
    grant_ok = client.patch(
        f"/api/v1/users/{basic_id}",
        json={"roles": ["cntr_admin"]},
        headers=_auth(admin_token),
    )
    assert grant_ok.status_code == 200, grant_ok.text


def test_register_throttled_like_login(client: TestClient) -> None:
    """G11: троттлинг саморегистрации — серия дублирующих попыток даёт 429."""
    from app.services import auth_throttle

    auth_throttle.reset()
    email = _email("throttle")
    first = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": "Throttle",
            "role_slug": "gk_customer",
        },
    )
    assert first.status_code == 201, first.text
    codes = [
        client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "Probe12345",
                "full_name": "Throttle",
                "role_slug": "gk_customer",
            },
        ).status_code
        for _ in range(auth_throttle.LIMIT + 1)
    ]
    assert all(code == 409 for code in codes[: auth_throttle.LIMIT]), codes
    assert codes[-1] == 429, codes
    assert (
        client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "Probe12345",
                "full_name": "Throttle",
                "role_slug": "gk_customer",
            },
        ).headers.get("X-Error-Code")
        == "AUTH_REGISTER_LIMIT"
    )


def test_register_accepts_only_ordinary_pii() -> None:
    """G20: регистрация принимает только обычные ПДн — иных полей в схеме нет."""
    from app.schemas import RegisterIn

    assert set(RegisterIn.model_fields) == {
        "email",
        "password",
        "full_name",
        "organization",
        "role_slug",
    }
