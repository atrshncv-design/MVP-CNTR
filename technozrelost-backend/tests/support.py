"""Test-only account provisioning helpers.

Central staff roles are not self-registerable. Tests provision those roles
through the database, mirroring an administrator assigning the role.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import struct
from datetime import UTC, datetime

import psycopg
from fastapi.testclient import TestClient

CNTR_STAFF_SLUGS = {"cntr_admin", "cntr_manager"}
PASSWORD = "Probe12345"

# Тикет 04: обязательные согласия при регистрации (см. app/services/consent_service.py).
DEFAULT_CONSENTS = [
    {"slug": "terms", "version": 1, "accepted": True},
    {"slug": "privacy", "version": 1, "accepted": True},
]


def seed_consent_versions() -> None:
    """Идемпотентный пере-seed версий согласий после TRUNCATE (тикет 04)."""
    from app.services.consent_service import SEED_CONSENTS

    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        for slug, version, title, text in SEED_CONSENTS:
            conn.execute(
                "INSERT INTO public.consent_versions "
                "(slug, version, title, text, is_draft, published_at) "
                "VALUES (%s, %s, %s, %s, TRUE, now()) "
                "ON CONFLICT (slug, version) DO NOTHING",
                (slug, version, title, text),
            )
    finally:
        conn.close()


def totp_code(secret: str, at: datetime | None = None, window: int = 0) -> str:
    """TOTP-код для тестов (RFC 6238, HMAC-SHA1, 6 цифр, 30с; window — шаги)."""
    key = base64.b32decode(secret, casefold=True)
    now = at or datetime.now(UTC)
    counter = int(now.timestamp()) // 30 + window
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


def register_test_user(
    client: TestClient,
    *,
    email: str,
    full_name: str,
    role_slug: str,
    organization: str | None = None,
    consents: list[dict] | None = None,
) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "full_name": full_name,
            "organization": organization,
            "role_slug": "gk_customer" if role_slug in CNTR_STAFF_SLUGS else role_slug,
            "consents": DEFAULT_CONSENTS if consents is None else consents,
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()

    if role_slug not in CNTR_STAFF_SLUGS:
        # Фикстура: пользователи тестов создаются сразу verified (тикет 01 —
        # чувствительные операции требуют подтверждённого email).
        _verify_user(data["user"]["id"])
        return data

    _assign_staff_role(data["user"]["id"], role_slug)
    _verify_user(data["user"]["id"])
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert login.status_code == 200, login.text
    return login.json()


def _verify_user(user_id: int) -> None:
    """Помечает тестового пользователя verified (эмуляция перехода по письму)."""
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        conn.execute(
            "UPDATE public.users SET status='verified', "
            "email_verified_at=COALESCE(email_verified_at, now()) WHERE id=%s",
            (user_id,),
        )
    finally:
        conn.close()


def _assign_staff_role(user_id: int, role_slug: str) -> None:
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        conn.execute("DELETE FROM public.user_roles WHERE user_id = %s", (user_id,))
        conn.execute(
            """
            INSERT INTO public.user_roles (user_id, role_id, is_primary)
            SELECT %s, id, TRUE FROM public.roles WHERE slug = %s
            """,
            (user_id, role_slug),
        )
    finally:
        conn.close()
