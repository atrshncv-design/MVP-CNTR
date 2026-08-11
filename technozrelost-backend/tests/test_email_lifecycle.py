"""Тикет 01 (identity-organizations): подтверждение email и lifecycle аккаунта.

Покрывает: одноразовость и истечение verification/reset-токенов, повторную
отправку (throttle), безопасные ответы без user enumeration, throttling входа,
отзыв сессий при смене пароля, блокировку/разблокировку админом, запрет
чувствительных операций до подтверждения email, аудит-события.
"""

from __future__ import annotations

import os
import uuid

import psycopg
from fastapi.testclient import TestClient

PASSWORD = "Probe12345"


def _unique_email() -> str:
    return f"lifecycle-{uuid.uuid4().hex[:10]}@example.com"


def _pg() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


def _outbox_token(email: str, template: str) -> str | None:
    """Открытый токен из тестовой доставки (APP_ENV=test пишет token в outbox)."""
    with _pg() as conn:
        row = conn.execute(
            "SELECT token FROM public.email_outbox "
            "WHERE recipient=%s AND template=%s ORDER BY id DESC LIMIT 1",
            (email, template),
        ).fetchone()
    return row[0] if row else None


def _register(client: TestClient, email: str, role_slug: str = "gk_customer") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "full_name": "Lifecycle Test",
            "role_slug": role_slug,
            "consents": [
                {"slug": "terms", "version": 1, "accepted": True},
                {"slug": "privacy", "version": 1, "accepted": True},
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _audit_count(action: str, user_id: int) -> int:
    with _pg() as conn:
        row = conn.execute(
            "SELECT count(*) FROM public.audit_trail WHERE action=%s AND user_id=%s",
            (action, user_id),
        ).fetchone()
    return int(row[0])


# ---------------------------------------------------------------------------
# Регистрация и статусы
# ---------------------------------------------------------------------------


def test_register_creates_unverified(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    assert data["user"]["status"] == "unverified"
    assert _outbox_token(email, "verification") is not None
    # Аудит регистрации присутствует.
    assert _audit_count("auth.register", data["user"]["id"]) >= 1


def test_register_duplicate_email_conflict(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "full_name": "Second",
            "role_slug": "gk_customer",
            "consents": [
                {"slug": "terms", "version": 1, "accepted": True},
                {"slug": "privacy", "version": 1, "accepted": True},
            ],
        },
    )
    assert response.status_code == 409


# ---------------------------------------------------------------------------
# Подтверждение email
# ---------------------------------------------------------------------------


def test_verify_email_happy_path(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    user_id = data["user"]["id"]
    token = _outbox_token(email, "verification")
    assert token

    response = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body is not None
    assert body["status"] == "verified"
    assert _audit_count("email.verified", user_id) == 1


def test_verify_email_single_use(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    token = _outbox_token(email, "verification")
    assert token
    first = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert first.status_code == 200
    second = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert second.status_code == 400


def test_verify_email_expired_token(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    token = _outbox_token(email, "verification")
    assert token
    with _pg() as conn:
        conn.execute(
            "UPDATE public.users SET email_verification_token_expires_at = "
            "now() - interval '1 hour' WHERE id=%s",
            (data["user"]["id"],),
        )
    response = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 400


def test_verify_email_invalid_token(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/verify-email", json={"token": "not-a-real-token"}
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Повторная отправка verification (throttle, без enumeration)
# ---------------------------------------------------------------------------


def test_resend_verification_new_token(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    first_token = _outbox_token(email, "verification")
    assert first_token
    # Throttle-окно: отодвигаем issued_at в прошлое, чтобы повторная отправка прошла.
    with _pg() as conn:
        conn.execute(
            "UPDATE public.users SET email_verification_token_expires_at = "
            "now() - interval '2 hours' WHERE email=%s",
            (email,),
        )
    response = client.post("/api/v1/auth/resend-verification", json={"email": email})
    assert response.status_code == 202
    second_token = _outbox_token(email, "verification")
    assert second_token and second_token != first_token
    assert _audit_count("email.resent", _user_id(client, email)) >= 1


def test_resend_verification_throttled(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    response = client.post("/api/v1/auth/resend-verification", json={"email": email})
    assert response.status_code == 429


def test_resend_verification_no_enumeration(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/resend-verification", json={"email": _unique_email()}
    )
    assert response.status_code == 202  # безопасный ответ для несуществующего email


# ---------------------------------------------------------------------------
# Восстановление пароля (без enumeration, одноразовые токены, отзыв сессий)
# ---------------------------------------------------------------------------


def test_forgot_password_no_enumeration(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/forgot-password", json={"email": _unique_email()}
    )
    assert response.status_code == 202


def test_reset_password_happy_path(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    client.post("/api/v1/auth/forgot-password", json={"email": email})
    token = _outbox_token(email, "password_reset")
    assert token

    new_password = "NewPass12345"
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": new_password},
    )
    assert response.status_code == 200, response.text

    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": new_password}
    )
    assert login.status_code == 200


def test_reset_password_single_use(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    client.post("/api/v1/auth/forgot-password", json={"email": email})
    token = _outbox_token(email, "password_reset")
    assert token
    first = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "NewPass12345"},
    )
    assert first.status_code == 200
    second = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "Another12345"},
    )
    assert second.status_code == 400


def test_reset_password_expired_token(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    client.post("/api/v1/auth/forgot-password", json={"email": email})
    token = _outbox_token(email, "password_reset")
    assert token
    with _pg() as conn:
        conn.execute(
            "UPDATE public.users SET password_reset_token_expires_at = now() - interval '1 hour' "
            "WHERE id=%s",
            (data["user"]["id"],),
        )
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "NewPass12345"},
    )
    assert response.status_code == 400


def test_reset_password_revokes_refresh_sessions(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200
    old_refresh = login.json()["refresh_token"]

    client.post("/api/v1/auth/forgot-password", json={"email": email})
    token = _outbox_token(email, "password_reset")
    assert token
    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "NewPass12345"},
    )
    assert reset.status_code == 200

    refresh = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh}
    )
    assert refresh.status_code == 401  # сессия отозвана


def test_change_password_revokes_refresh_sessions(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    user_id = data["user"]["id"]
    token = _outbox_token(email, "verification")
    assert token
    client.post("/api/v1/auth/verify-email", json={"token": token})

    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200
    old_refresh = login.json()["refresh_token"]
    access = login.json()["access_token"]

    change = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access}"},
        json={"old_password": PASSWORD, "new_password": "NewPass12345"},
    )
    assert change.status_code == 204, change.text
    assert _audit_count("password.changed", user_id) >= 1

    refresh = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh}
    )
    assert refresh.status_code == 401


# ---------------------------------------------------------------------------
# Throttling входа и блокировка
# ---------------------------------------------------------------------------


def test_login_throttling_locks_account(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    user_id = data["user"]["id"]

    for _ in range(5):
        bad = client.post(
            "/api/v1/auth/login", json={"email": email, "password": "WrongPass123"}
        )
        assert bad.status_code == 401

    locked = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert locked.status_code == 429  # аккаунт заблокирован на 15 минут
    assert _audit_count("auth.locked", user_id) == 1


def test_blocked_user_cannot_login_and_unblock_restores(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    user_id = data["user"]["id"]
    token = _outbox_token(email, "verification")
    assert token
    client.post("/api/v1/auth/verify-email", json={"token": token})

    # Логинимся админом (тестовая фикстура через support.register_test_user).
    from tests.support import register_test_user  # noqa: PLC0415

    admin = register_test_user(
        client,
        email=f"admin-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Admin",
        role_slug="cntr_admin",
    )
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}

    block = client.post(
        f"/api/v1/users/{user_id}/block", headers=admin_headers
    )
    assert block.status_code == 200, block.text
    assert block.json()["status"] == "blocked"
    # Аудит пишется от имени админа, target_user_id — в details.
    assert _audit_target_count("user.blocked", user_id) >= 1

    denied = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert denied.status_code == 403

    unblock = client.post(
        f"/api/v1/users/{user_id}/unblock", headers=admin_headers
    )
    assert unblock.status_code == 200
    allowed = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert allowed.status_code == 200


# ---------------------------------------------------------------------------
# Неподтверждённый email: запрет чувствительных операций
# ---------------------------------------------------------------------------


def test_unverified_cannot_publish_project(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    access = data["access_token"]
    headers = {"Authorization": f"Bearer {access}"}

    created = client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Unverified project"},
    )
    # Создание черновика разрешено (личный черновик), но publish требует verified.
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]

    publish = client.put(
        f"/api/v1/projects/{project_id}/publish",
        headers=headers,
        json={"is_public": True},
    )
    assert publish.status_code == 403  # требуется подтверждение email


def _audit_target_count(action: str, target_user_id: int) -> int:
    with _pg() as conn:
        row = conn.execute(
            "SELECT count(*) FROM public.audit_trail "
            "WHERE action=%s AND details->>'target_user_id' = %s",
            (action, str(target_user_id)),
        ).fetchone()
    return int(row[0])


def _user_id(client: TestClient, email: str) -> int:
    with _pg() as conn:
        row = conn.execute(
            "SELECT id FROM public.users WHERE email=%s", (email,)
        ).fetchone()
    assert row
    return int(row[0])
