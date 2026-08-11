"""Тикет 03 (security-infrastructure): append-only аудит и наблюдаемость.

Покрывает: аудит login/register/upload/download без секретов и контента,
redacted логи (пароли/токены/MFA-коды не попадают в логи), kill switches
(registration/uploads/external_access/ai → 503), метрики.
"""

from __future__ import annotations

import io
import os
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

PASSWORD = "Probe12345"
PDF_BYTES = b"%PDF-1.4\n" + b"\x00" * 64


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    from tests.support import register_test_user

    data = register_test_user(client, email=_email("aud"), full_name="Аудит", role_slug=role)
    return data["access_token"], data["user"]["id"]


def _create_project(client: TestClient, token: str) -> int:
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(token),
        json={
            "name": "Проект-аудит",
            "questionnaire_results": [
                {"level_id": 1, "checked_items": ["Идея"], "percentage": 100.0}
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _upload(client: TestClient, token: str, project_id: int) -> int:
    response = client.post(
        f"/api/v1/projects/{project_id}/files",
        headers=_auth(token),
        files={"file": ("doc.pdf", io.BytesIO(PDF_BYTES), "application/pdf")},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _pg() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


def _audit_actions(user_id: int) -> list[str]:
    with _pg() as conn:
        rows = conn.execute(
            "SELECT action FROM public.audit_trail WHERE user_id=%s ORDER BY id",
            (user_id,),
        ).fetchall()
    return [r[0] for r in rows]


# ---------------------------------------------------------------------------
# Аудит: события пишутся, без секретов/контента
# ---------------------------------------------------------------------------


def test_register_and_login_write_audit(client: TestClient) -> None:
    token, user_id = _register(client)
    actions = _audit_actions(user_id)
    assert "auth.register" in actions

    # Успешный вход.
    email = _email_by_id(user_id)
    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200
    assert "auth.login_success" in _audit_actions(user_id)

    # Неудачный вход.
    bad = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "WrongPass123"}
    )
    assert bad.status_code == 401
    assert "auth.login_failed" in _audit_actions(user_id)


def test_audit_details_contain_no_secrets(client: TestClient) -> None:
    _token, user_id = _register(client)
    with _pg() as conn:
        rows = conn.execute(
            "SELECT action, details::text FROM public.audit_trail WHERE user_id=%s",
            (user_id,),
        ).fetchall()
    for action, details in rows:
        assert "password" not in details.lower(), f"{action}: {details}"
        assert "refresh_token" not in details.lower(), f"{action}: {details}"
        assert "token" not in details.lower() or action in (
            "auth.register",
        ), f"{action}: {details}"


def test_files_upload_download_write_audit_without_content(client: TestClient) -> None:
    token, user_id = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload(client, token, project_id)

    dl = client.get(f"/api/v1/files/{file_id}/download", headers=_auth(token))
    assert dl.status_code == 200
    assert dl.content == PDF_BYTES

    actions = _audit_actions(user_id)
    assert any(a == "files.uploaded" for a in actions)
    assert any(a == "files.downloaded" for a in actions)

    # Details не содержат контента файла.
    with _pg() as conn:
        rows = conn.execute(
            "SELECT details::text FROM public.audit_trail WHERE user_id=%s "
            "AND action IN ('files.uploaded','files.downloaded')",
            (user_id,),
        ).fetchall()
    for (details,) in rows:
        assert "%PDF" not in details
        assert len(details) < 500  # метаданные, не контент


# ---------------------------------------------------------------------------
# Redacted логи
# ---------------------------------------------------------------------------


def test_logs_do_not_contain_passwords_or_tokens(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    import logging

    with caplog.at_level(logging.INFO):
        client.post(
            "/api/v1/auth/register",
            json={
                "email": _email("red"),
                "password": PASSWORD,
                "full_name": "Redact",
                "role_slug": "gk_customer",
            },
        )
        client.post(
            "/api/v1/auth/login",
            json={"email": _email("red2"), "password": PASSWORD},
        )
    log_text = caplog.text
    assert PASSWORD not in log_text
    assert "refresh_token" not in log_text.lower()


def test_mfa_code_words_redacted(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    import logging

    with caplog.at_level(logging.INFO):
        client.post(
            "/api/v1/auth/register",
            json={
                "email": _email("mfa"),
                "password": PASSWORD,
                "full_name": "MFA",
                "role_slug": "gk_customer",
            },
        )
    log_text = caplog.text
    assert "verification_code" not in log_text.lower()
    assert "otp" not in log_text.lower() or "ОТП" not in log_text


# ---------------------------------------------------------------------------
# Kill switches
# ---------------------------------------------------------------------------


def _staff(client: TestClient) -> tuple[str, int]:
    from tests.support import register_test_user

    data = register_test_user(
        client, email=_email("staff"), full_name="Staff", role_slug="cntr_admin"
    )
    return data["access_token"], data["user"]["id"]


def test_kill_switch_registration(client: TestClient) -> None:
    from app.services import kill_switches

    try:
        token, _ = _staff(client)
        headers = _auth(token)

        off = client.post(
            "/api/v1/admin/kill-switches/registration",
            headers=headers,
            json={"enabled": False},
        )
        assert off.status_code == 200, off.text
        assert off.json()["enabled"] is False

        denied = client.post(
            "/api/v1/auth/register",
            json={
                "email": _email("reg"),
                "password": PASSWORD,
                "full_name": "Reg",
                "role_slug": "gk_customer",
            },
        )
        assert denied.status_code == 503

        on = client.post(
            "/api/v1/admin/kill-switches/registration",
            headers=headers,
            json={"enabled": True},
        )
        assert on.status_code == 200
        allowed = client.post(
            "/api/v1/auth/register",
            json={
                "email": _email("reg"),
                "password": PASSWORD,
                "full_name": "Reg",
                "role_slug": "gk_customer",
                "consents": [
                    {"slug": "terms", "version": 1, "accepted": True},
                    {"slug": "privacy", "version": 1, "accepted": True},
                ],
            },
        )
        assert allowed.status_code in (201, 409)  # 409 — если email занят
    finally:
        from app.services import kill_switches

        kill_switches.reset()


def test_kill_switch_uploads(client: TestClient) -> None:
    from app.services import kill_switches

    try:
        token, _ = _register(client)
        project_id = _create_project(client, token)
        staff_token, _ = _staff(client)
        off = client.post(
            "/api/v1/admin/kill-switches/uploads",
            headers=_auth(staff_token),
            json={"enabled": False},
        )
        assert off.status_code == 200
        denied = client.post(
            f"/api/v1/projects/{project_id}/files",
            headers=_auth(token),
            files={"file": ("doc.pdf", io.BytesIO(PDF_BYTES), "application/pdf")},
        )
        assert denied.status_code == 503
    finally:
        kill_switches.reset()


def test_kill_switch_external_access(client: TestClient) -> None:
    from app.services import kill_switches

    try:
        staff_token, _ = _staff(client)
        off = client.post(
            "/api/v1/admin/kill-switches/external_access",
            headers=_auth(staff_token),
            json={"enabled": False},
        )
        assert off.status_code == 200
        denied = client.get("/api/v1/executors")
        assert denied.status_code == 503
    finally:
        kill_switches.reset()


def test_kill_switch_ai(client: TestClient) -> None:
    from app.services import kill_switches

    try:
        token, _ = _register(client)
        staff_token, _ = _staff(client)
        off = client.post(
            "/api/v1/admin/kill-switches/ai",
            headers=_auth(staff_token),
            json={"enabled": False},
        )
        assert off.status_code == 200
        denied = client.post(
            "/api/v1/chat",
            headers=_auth(token),
            json={"message": "Тест", "history": []},
        )
        assert denied.status_code == 503
    finally:
        kill_switches.reset()


def test_kill_switch_changes_are_audited(client: TestClient) -> None:
    from app.services import kill_switches

    try:
        staff_token, staff_id = _staff(client)
        client.post(
            "/api/v1/admin/kill-switches/ai",
            headers=_auth(staff_token),
            json={"enabled": False},
        )
        assert any(a == "kill_switch.changed" for a in _audit_actions(staff_id))
    finally:
        kill_switches.reset()


# ---------------------------------------------------------------------------
# Метрики
# ---------------------------------------------------------------------------


def test_metrics_counters_grow(client: TestClient) -> None:
    from app.services import security_metrics
    from app.services.security_metrics import reset as metrics_reset

    metrics_reset()
    _token, _user_id = _register(client)
    metrics = security_metrics.snapshot()
    assert metrics["auth_register_total"] >= 1

    client.post(
        "/api/v1/auth/login",
        json={"email": _email("nonexistent"), "password": "WrongPass123"},
    )
    metrics2 = security_metrics.snapshot()
    assert metrics2["auth_login_failed_total"] >= 1


def _email_by_id(user_id: int) -> str:
    with _pg() as conn:
        row = conn.execute(
            "SELECT email FROM public.users WHERE id=%s", (user_id,)
        ).fetchone()
    assert row
    return str(row[0])
