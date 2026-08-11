"""Тикет 04 (identity-organizations): версионируемые согласия и обезличивание.

Покрывает: обязательность принятия terms/privacy при регистрации (400),
фиксацию принятия с версией, pending при публикации новой версии (+403 на
чувствительные операции), каталог с меткой is_draft, запрос удаления с отзывом
сессий и идемпотентностью, обезличивание PII с сохранением audit trail,
повторный process (no-op), revoke согласий.
"""

from __future__ import annotations

import os
import uuid

import psycopg
from fastapi.testclient import TestClient

PASSWORD = "Probe12345"
CONSENTS_V1 = [
    {"slug": "terms", "version": 1, "accepted": True},
    {"slug": "privacy", "version": 1, "accepted": True},
]


def _unique_email() -> str:
    return f"consent-{uuid.uuid4().hex[:10]}@example.com"


def _pg() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


def _register(client: TestClient, email: str, consents: list[dict] | None = CONSENTS_V1) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "full_name": "Consent Test",
            "role_slug": "gk_customer",
            "consents": consents,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _user_id(email: str) -> int:
    with _pg() as conn:
        row = conn.execute("SELECT id FROM public.users WHERE email=%s", (email,)).fetchone()
    assert row
    return int(row[0])


def _audit_count(action: str, user_id: int) -> int:
    with _pg() as conn:
        row = conn.execute(
            "SELECT count(*) FROM public.audit_trail WHERE action=%s AND user_id=%s",
            (action, user_id),
        ).fetchone()
    return int(row[0])


def _acceptance_count(user_id: int) -> int:
    with _pg() as conn:
        row = conn.execute(
            "SELECT count(*) FROM public.consent_acceptances WHERE user_id=%s",
            (user_id,),
        ).fetchone()
    return int(row[0])


def _insert_consent_version(slug: str, version: int, is_draft: bool = False) -> None:
    with _pg() as conn:
        conn.execute(
            "INSERT INTO public.consent_versions "
            "(slug, version, title, text, is_draft, published_at) "
            "VALUES (%s, %s, %s, %s, %s, now()) "
            "ON CONFLICT (slug, version) DO NOTHING",
            (slug, version, f"Title {slug} v{version}", f"Text {slug} v{version}", is_draft),
        )


# ---------------------------------------------------------------------------
# Регистрация и обязательные согласия
# ---------------------------------------------------------------------------


def test_register_without_consents_400(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": _unique_email(),
            "password": PASSWORD,
            "full_name": "No Consents",
            "role_slug": "gk_customer",
        },
    )
    assert response.status_code == 400
    body = response.json()
    assert body is not None
    assert "соглас" in body["detail"].lower()


def test_register_with_consents_creates_acceptances(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    user_id = _user_id(email)
    assert _acceptance_count(user_id) == 2  # terms + privacy


def test_register_with_unknown_version_400(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": _unique_email(),
            "password": PASSWORD,
            "full_name": "Bad Version",
            "role_slug": "gk_customer",
            "consents": [
                {"slug": "terms", "version": 999, "accepted": True},
                {"slug": "privacy", "version": 1, "accepted": True},
            ],
        },
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Каталог, mine, pending при новой версии
# ---------------------------------------------------------------------------


def test_consents_catalog_marks_drafts(client: TestClient) -> None:
    response = client.get("/api/v1/consents")
    assert response.status_code == 200
    slugs: dict = {}
    for c in response.json():
        assert c is not None
        slugs[c["slug"]] = c
    assert {"terms", "privacy"} <= set(slugs)
    assert slugs["terms"]["is_draft"] is True  # ЧЕРНОВИК до утверждения юристом


def test_consents_mine_shows_accepted(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    mine = client.get("/api/v1/consents/mine", headers=headers)
    assert mine.status_code == 200
    by_slug = {c["slug"]: c for c in mine.json()}
    assert by_slug["terms"]["pending"] is False
    assert by_slug["privacy"]["pending"] is False


def test_new_version_marks_pending_and_blocks_publish(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    user_id = _user_id(email)
    token = _outbox_token(email)
    assert token
    client.post("/api/v1/auth/verify-email", json={"token": token})

    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Новая версия terms → пользователь должен принять повторно.
    _insert_consent_version("terms", 2)

    mine = client.get("/api/v1/consents/mine", headers=headers)
    by_slug = {c["slug"]: c for c in mine.json()}
    assert by_slug["terms"]["pending"] is True

    created = client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Pending consent project", "target_level": 1},
    )
    assert created.status_code == 201
    publish = client.put(
        f"/api/v1/projects/{created.json()['id']}/publish",
        headers=headers,
        json={"is_public": True},
    )
    assert publish.status_code == 403  # чувствительная операция заблокирована

    # Повторное принятие новой версии снимает consent-блокировку: publish теперь
    # проходит согласие и упирается только в бизнес-гейт УГТ (draft без оценки →
    # 409, НЕ 403 от согласий).
    accept = client.post(
        "/api/v1/consents/accept", headers=headers, json={"slug": "terms", "version": 2}
    )
    assert accept.status_code == 200, accept.text
    publish2 = client.put(
        f"/api/v1/projects/{created.json()['id']}/publish",
        headers=headers,
        json={"is_public": True},
    )
    assert publish2.status_code == 409, publish2.text
    assert "УГТ" in publish2.json()["detail"]
    assert _audit_count("consent.accepted", user_id) >= 1


def _outbox_token(email: str) -> str | None:
    with _pg() as conn:
        row = conn.execute(
            "SELECT token FROM public.email_outbox WHERE recipient=%s "
            "ORDER BY id DESC LIMIT 1",
            (email,),
        ).fetchone()
    return row[0] if row else None


# ---------------------------------------------------------------------------
# Запрос удаления и обезличивание
# ---------------------------------------------------------------------------


def test_deletion_request_revokes_sessions_and_is_idempotent(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    user_id = data["user"]["id"]
    token = _outbox_token(email)
    assert token
    client.post("/api/v1/auth/verify-email", json={"token": token})

    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200
    refresh_token = login.json()["refresh_token"]
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    request = client.post("/api/v1/account/deletion-request", headers=headers)
    assert request.status_code == 200, request.text
    assert request.json()["state"] == "pending"
    assert _audit_count("account.deletion_requested", user_id) == 1

    # Сессии отозваны.
    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh.status_code == 401

    # Идемпотентность: повторный запрос пока pending — 200 без дубля аудита.
    second = client.post("/api/v1/account/deletion-request", headers=headers)
    assert second.status_code == 200
    assert _audit_count("account.deletion_requested", user_id) == 1


def test_deletion_process_anonymizes_and_preserves_audit(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    user_id = data["user"]["id"]
    token = _outbox_token(email)
    assert token
    client.post("/api/v1/auth/verify-email", json={"token": token})

    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    client.post("/api/v1/account/deletion-request", headers=headers)

    # Админ обрабатывает запрос (в test-режиме MFA-гейт ослаблен).
    from tests.support import register_test_user

    admin = register_test_user(
        client,
        email=f"adm-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Adm",
        role_slug="cntr_admin",
    )
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}

    req = client.get("/api/v1/account/deletion-request", headers=headers)
    assert req.status_code == 200
    request_id = req.json()["id"]

    processed = client.post(
        f"/api/v1/admin/deletion-requests/{request_id}/process", headers=admin_headers
    )
    assert processed.status_code == 200, processed.text
    assert processed.json()["state"] == "completed"

    # PII обезличена: email заменён, status deleted, пароль невалиден.
    with _pg() as conn:
        row = conn.execute(
            "SELECT email, status, is_active, full_name FROM public.users WHERE id=%s",
            (user_id,),
        ).fetchone()
    assert row is not None
    anonymized_email, status, is_active, full_name = row
    assert anonymized_email.startswith(f"deleted-{user_id}@")
    assert status == "deleted"
    assert is_active is False
    assert full_name == ""

    # Audit trail сохранён (юридический аудит), включая события до удаления.
    assert _audit_count("auth.register", user_id) >= 1
    assert _audit_count("account.deletion_requested", user_id) == 1

    # Логин невозможен.
    denied = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert denied.status_code in (401, 403)

    # Повторный process — no-op (идемпотентность).
    again = client.post(
        f"/api/v1/admin/deletion-requests/{request_id}/process", headers=admin_headers
    )
    assert again.status_code == 200
    again_body = again.json()
    assert again_body is not None
    assert again_body["state"] == "completed"


def test_revoke_optional_consent(client: TestClient) -> None:
    email = _unique_email()
    _register(client, email)
    token = _outbox_token(email)
    assert token
    client.post("/api/v1/auth/verify-email", json={"token": token})

    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Опциональное согласие: создаём, принимаем, отзываем.
    _insert_consent_version("newsletter", 1)
    accept = client.post(
        "/api/v1/consents/accept", headers=headers, json={"slug": "newsletter", "version": 1}
    )
    assert accept.status_code == 200, accept.text
    with _pg() as conn:
        row = conn.execute(
            "SELECT id FROM public.consent_versions WHERE slug='newsletter' AND version=1"
        ).fetchone()
    assert row
    consent_version_id = int(row[0])

    revoke = client.post(f"/api/v1/consents/{consent_version_id}/revoke", headers=headers)
    assert revoke.status_code == 200, revoke.text

    with _pg() as conn:
        row = conn.execute(
            "SELECT count(*) FROM public.consent_acceptances "
            "WHERE user_id=%s AND consent_version_id=%s",
            (_user_id(email), consent_version_id),
        ).fetchone()
    assert int(row[0]) == 0  # запись принятия удалена


def test_revoke_required_consent_triggers_deletion_request(client: TestClient) -> None:
    email = _unique_email()
    data = _register(client, email)
    user_id = data["user"]["id"]
    token = _outbox_token(email)
    assert token
    client.post("/api/v1/auth/verify-email", json={"token": token})

    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    with _pg() as conn:
        row = conn.execute(
            "SELECT consent_version_id FROM public.consent_acceptances "
            "WHERE user_id=%s ORDER BY id LIMIT 1",
            (user_id,),
        ).fetchone()
    assert row
    consent_version_id = int(row[0])

    revoke = client.post(
        f"/api/v1/consents/{consent_version_id}/revoke", headers=headers
    )
    assert revoke.status_code == 200, revoke.text
    # Создан deletion-request (отзыв обязательного согласия = отказ от платформы).
    deletion = client.get("/api/v1/account/deletion-request", headers=headers)
    assert deletion.status_code == 200
    assert deletion.json()["state"] == "pending"
    assert _audit_count("consent.revoked", user_id) == 1
