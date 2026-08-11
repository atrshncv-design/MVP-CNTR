"""MFA для служебных ролей (тикет 02 identity-organizations).

Покрытие: enroll (только staff, 409 при активной MFA), confirm (happy/неверный код,
секрет не возвращается после), login→challenge→verify (happy), brute force
(5 неверных → locked, повторное использование/истёкший challenge → 401),
recovery-коды (happy, одноразовость, 10 кодов), disable, admin reset,
MFA-гейт служебного кабинета (403), аудит.
"""

from __future__ import annotations

import os

import psycopg
from fastapi.testclient import TestClient

from tests.support import PASSWORD, totp_code

STAFF_EMAIL = "mfa.manager@example.com"
ADMIN_EMAIL = "mfa.admin@example.com"
OTHER_EMAIL = "mfa.customer@example.com"
BAD_CODE = "000000"


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _db() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


def _audit_actions(client: TestClient, admin_token: str) -> list[str]:
    resp = client.get("/api/v1/admin/audit?limit=500", headers=_headers(admin_token))
    assert resp.status_code == 200, resp.text
    return [entry["action"] for entry in resp.json()]


def _enroll(client: TestClient, token: str) -> dict:
    resp = client.post("/api/v1/auth/mfa/enroll", headers=_headers(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "secret" in body and "otpauth_url" in body
    return body


def _confirm(client: TestClient, token: str, secret: str) -> list[str]:
    resp = client.post(
        "/api/v1/auth/mfa/confirm",
        headers=_headers(token),
        json={"code": totp_code(secret)},
    )
    assert resp.status_code == 200, resp.text
    codes = resp.json()["recovery_codes"]
    assert len(codes) == 10
    assert all(len(c) == 10 for c in codes)
    return codes


def _staff_with_mfa(client: TestClient, email: str = STAFF_EMAIL) -> tuple[dict, str, list[str]]:
    """Создаёт служебного пользователя с включённой MFA → (login, secret, codes)."""
    from tests.support import register_test_user

    login = register_test_user(
        client, email=email, full_name="MFA Manager", role_slug="cntr_manager"
    )
    token = login["access_token"]
    secret = _enroll(client, token)["secret"]
    codes = _confirm(client, token, secret)
    return login, secret, codes


def _login_challenge(client: TestClient, email: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["mfa_required"] is True
    assert "challenge_token" in body
    return body["challenge_token"]


# ─── Enroll ──────────────────────────────────────────────────────────────────


def test_enroll_requires_staff_role(client: TestClient) -> None:
    from tests.support import register_test_user

    customer = register_test_user(
        client, email=OTHER_EMAIL, full_name="Customer", role_slug="gk_customer"
    )
    resp = client.post(
        "/api/v1/auth/mfa/enroll", headers=_headers(customer["access_token"])
    )
    assert resp.status_code == 403


def test_enroll_confirm_repeat_enroll_conflict(client: TestClient) -> None:
    login, secret, _ = _staff_with_mfa(client)

    # Повторный enroll при активной MFA → 409, секрет НЕ возвращается.
    resp = client.post("/api/v1/auth/mfa/enroll", headers=_headers(login["access_token"]))
    assert resp.status_code == 409
    assert "secret" not in resp.json()


def test_enroll_reuses_secret_before_confirm(client: TestClient) -> None:
    from tests.support import register_test_user

    login = register_test_user(
        client, email=STAFF_EMAIL, full_name="MFA Manager", role_slug="cntr_manager"
    )
    token = login["access_token"]
    first = _enroll(client, token)
    second = _enroll(client, token)  # до confirm — тот же секрет, MFA ещё не активна
    assert second["secret"] == first["secret"]
    _confirm(client, token, first["secret"])


# ─── Confirm ─────────────────────────────────────────────────────────────────


def test_confirm_wrong_code_rejected(client: TestClient) -> None:
    from tests.support import register_test_user

    login = register_test_user(
        client, email=STAFF_EMAIL, full_name="MFA Manager", role_slug="cntr_manager"
    )
    token = login["access_token"]
    secret = _enroll(client, token)["secret"]
    resp = client.post(
        "/api/v1/auth/mfa/confirm", headers=_headers(token), json={"code": BAD_CODE}
    )
    assert resp.status_code == 401
    # MFA остаётся неактивной: повторный enroll возможен, confirm ещё ждёт.
    resp = client.post(
        "/api/v1/auth/mfa/confirm",
        headers=_headers(token),
        json={"code": totp_code(secret)},
    )
    assert resp.status_code == 200


def test_confirm_when_not_enrolled(client: TestClient) -> None:
    from tests.support import register_test_user

    login = register_test_user(
        client, email=STAFF_EMAIL, full_name="MFA Manager", role_slug="cntr_manager"
    )
    resp = client.post(
        "/api/v1/auth/mfa/confirm", headers=_headers(login["access_token"]), json={"code": "123456"}
    )
    assert resp.status_code == 404


# ─── Login → Challenge → Verify ──────────────────────────────────────────────


def test_login_mfa_required_and_verify_happy(client: TestClient) -> None:
    login, secret, _ = _staff_with_mfa(client)

    challenge = _login_challenge(client, STAFF_EMAIL)
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": totp_code(secret)},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["email"] == STAFF_EMAIL


def test_login_staff_without_mfa_returns_tokens(client: TestClient) -> None:
    from tests.support import register_test_user

    login = register_test_user(
        client, email=STAFF_EMAIL, full_name="MFA Manager", role_slug="cntr_manager"
    )
    assert "access_token" in login
    assert not login.get("mfa_required", False)


def test_verify_wrong_code_attempts_then_locked(client: TestClient) -> None:
    from tests.support import register_test_user

    admin = register_test_user(
        client, email=ADMIN_EMAIL, full_name="MFA Admin", role_slug="cntr_admin"
    )
    admin_token = admin["access_token"]

    login, secret, _ = _staff_with_mfa(client)
    assert login["access_token"]

    challenge = _login_challenge(client, STAFF_EMAIL)
    for _ in range(4):
        resp = client.post(
            "/api/v1/auth/mfa/verify",
            json={"challenge_token": challenge, "code": BAD_CODE},
        )
        assert resp.status_code == 401

    # 5-я неудача блокирует challenge (locked) → 403 + аудит mfa.locked.
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": BAD_CODE},
    )
    assert resp.status_code == 403
    assert "mfa.locked" in _audit_actions(client, admin_token)

    # Последующие попытки с тем же challenge отклоняются (401 used).
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": totp_code(secret)},
    )
    assert resp.status_code == 401


def test_verify_challenge_single_use(client: TestClient) -> None:
    login, secret, _ = _staff_with_mfa(client)
    challenge = _login_challenge(client, STAFF_EMAIL)

    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": totp_code(secret)},
    )
    assert resp.status_code == 200

    # Повторное использование того же challenge → 401.
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": totp_code(secret)},
    )
    assert resp.status_code == 401


def test_verify_expired_challenge(client: TestClient) -> None:
    login, secret, _ = _staff_with_mfa(client)
    challenge = _login_challenge(client, STAFF_EMAIL)

    with _db() as conn:
        conn.execute(
            "UPDATE public.mfa_challenges SET expires_at = now() - interval '1 minute'"
        )
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": totp_code(secret)},
    )
    assert resp.status_code == 401
    assert login["access_token"]


def test_verify_unknown_challenge(client: TestClient) -> None:
    _staff_with_mfa(client)
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": "definitely-not-a-token", "code": "123456"},
    )
    assert resp.status_code == 401


# ─── Recovery-коды ───────────────────────────────────────────────────────────


def test_recovery_code_happy_and_one_time(client: TestClient) -> None:
    _, _, codes = _staff_with_mfa(client)
    recovery = codes[0]

    challenge = _login_challenge(client, STAFF_EMAIL)
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": recovery},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_token"]

    # Одноразовость: тот же recovery-код больше не принимается.
    challenge2 = _login_challenge(client, STAFF_EMAIL)
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge2, "code": recovery},
    )
    assert resp.status_code == 401


def test_recovery_codes_reissue_requires_totp(client: TestClient) -> None:
    login, secret, original = _staff_with_mfa(client)

    # Без TOTP-кода — 401.
    resp = client.post(
        "/api/v1/auth/mfa/recovery-codes",
        headers=_headers(login["access_token"]),
        json={"code": BAD_CODE},
    )
    assert resp.status_code == 401

    # С валидным TOTP — новый набор (ротация; старые коды отозваны).
    resp = client.post(
        "/api/v1/auth/mfa/recovery-codes",
        headers=_headers(login["access_token"]),
        json={"code": totp_code(secret)},
    )
    assert resp.status_code == 200, resp.text
    new_codes = resp.json()["recovery_codes"]
    assert len(new_codes) == 10
    assert set(new_codes) != set(original)

    challenge = _login_challenge(client, STAFF_EMAIL)
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": original[0]},
    )
    assert resp.status_code == 401  # старый набор отозван


# ─── Disable / Admin reset ───────────────────────────────────────────────────


def test_disable_with_totp(client: TestClient) -> None:
    login, secret, _ = _staff_with_mfa(client)

    resp = client.post(
        "/api/v1/auth/mfa/disable",
        headers=_headers(login["access_token"]),
        json={"code": BAD_CODE},
    )
    assert resp.status_code == 401

    resp = client.post(
        "/api/v1/auth/mfa/disable",
        headers=_headers(login["access_token"]),
        json={"code": totp_code(secret)},
    )
    assert resp.status_code == 204

    # MFA выключена → login выдаёт токены напрямую.
    resp = client.post(
        "/api/v1/auth/login", json={"email": STAFF_EMAIL, "password": PASSWORD}
    )
    assert resp.status_code == 200
    assert resp.json().get("mfa_required") is not True
    assert resp.json()["access_token"]


def test_admin_reset_lost_mfa(client: TestClient) -> None:
    from tests.support import register_test_user

    admin = register_test_user(
        client, email=ADMIN_EMAIL, full_name="MFA Admin", role_slug="cntr_admin"
    )
    admin_token = admin["access_token"]

    # Жертва сброса: staff с включённой MFA.
    login = register_test_user(
        client, email=STAFF_EMAIL, full_name="MFA Manager", role_slug="cntr_manager"
    )
    secret = _enroll(client, login["access_token"])["secret"]
    _confirm(client, login["access_token"], secret)
    victim_id = login["user"]["id"]

    resp = client.post(
        f"/api/v1/users/{victim_id}/mfa-reset", headers=_headers(admin_token)
    )
    assert resp.status_code == 200, resp.text

    # После сброса login снова выдаёт токены (MFA снята).
    resp = client.post(
        "/api/v1/auth/login", json={"email": STAFF_EMAIL, "password": PASSWORD}
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]
    assert "mfa.admin_reset" in _audit_actions(client, admin_token)


# ─── MFA-гейт служебного кабинета ───────────────────────────────────────────


def test_staff_endpoint_requires_mfa(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings
    from tests.support import register_test_user

    login = register_test_user(
        client, email=STAFF_EMAIL, full_name="MFA Manager", role_slug="cntr_manager"
    )
    headers = _headers(login["access_token"])

    # В APP_ENV=test гейт ослаблен (см. require_staff_mfa docstring); для проверки
    # самого гейта временно переводим settings в dev-режим (прод не ослабляется).
    monkeypatch.setattr(settings, "app_env", "dev")
    resp = client.get("/api/v1/manager/queue/drafts", headers=headers)
    assert resp.status_code == 403
    assert "MFA" in resp.json()["detail"]

    # В test-режиме тот же эндпоинт доступен (фикстуры без MFA-флоу).
    monkeypatch.setattr(settings, "app_env", "test")
    resp = client.get("/api/v1/manager/queue/drafts", headers=headers)
    assert resp.status_code == 200


def test_staff_endpoint_ok_with_mfa_even_in_dev(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    login, secret, _ = _staff_with_mfa(client)
    challenge = _login_challenge(client, STAFF_EMAIL)
    resp = client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": totp_code(secret)},
    )
    assert resp.status_code == 200
    headers = _headers(resp.json()["access_token"])

    monkeypatch.setattr(settings, "app_env", "dev")
    resp = client.get("/api/v1/manager/queue/drafts", headers=headers)
    assert resp.status_code == 200


# ─── Аудит ───────────────────────────────────────────────────────────────────


def test_audit_trail_records_mfa_events(client: TestClient) -> None:
    from tests.support import register_test_user

    admin = register_test_user(
        client, email=ADMIN_EMAIL, full_name="MFA Admin", role_slug="cntr_admin"
    )
    admin_token = admin["access_token"]

    login, secret, codes = _staff_with_mfa(client)
    # failed: неверный код на challenge.
    challenge = _login_challenge(client, STAFF_EMAIL)
    client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": BAD_CODE},
    )
    # verified: успешный вход по TOTP.
    challenge = _login_challenge(client, STAFF_EMAIL)
    client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": totp_code(secret)},
    )
    # recovery_used: вход по recovery-коду.
    challenge = _login_challenge(client, STAFF_EMAIL)
    client.post(
        "/api/v1/auth/mfa/verify",
        json={"challenge_token": challenge, "code": codes[1]},
    )
    # disabled.
    client.post(
        "/api/v1/auth/mfa/disable",
        headers=_headers(login["access_token"]),
        json={"code": totp_code(secret)},
    )

    actions = _audit_actions(client, admin_token)
    for expected in (
        "mfa.enrolled",
        "mfa.confirmed",
        "mfa.failed",
        "mfa.verified",
        "mfa.recovery_used",
        "mfa.disabled",
    ):
        assert expected in actions, f"missing {expected} in {actions}"
