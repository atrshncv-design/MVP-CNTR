"""Защита от брутфорса: лимит неудачных логинов с одного источника (R05.5)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def _email() -> str:
    return f"throttle-{uuid.uuid4().hex[:8]}@example.com"


def _login(
    client: TestClient,
    email: str,
    password: str,
    xff: str | None = None,
    x_real_ip: str | None = None,
):
    headers = {}
    if xff:
        headers["X-Forwarded-For"] = xff
    if x_real_ip:
        headers["X-Real-IP"] = x_real_ip
    return client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}, headers=headers or None
    )


def test_failed_logins_are_rate_limited(client: TestClient) -> None:
    from app.services import auth_throttle

    auth_throttle.reset()
    email = _email()
    statuses = [_login(client, email, "wrong-password").status_code for _ in range(12)]
    assert all(code == 401 for code in statuses[: auth_throttle.LIMIT])
    assert statuses[-1] == 429


def test_rate_limit_is_scoped_per_account(client: TestClient) -> None:
    from app.services import auth_throttle

    auth_throttle.reset()
    first, second = _email(), _email()
    for _ in range(auth_throttle.LIMIT):
        assert _login(client, first, "wrong-password").status_code == 401
    assert _login(client, first, "wrong-password").status_code == 429
    # Другая пара «email+источник» не блокируется
    assert _login(client, second, "wrong-password").status_code == 401


def test_rate_limit_counts_forwarded_ips_separately(client: TestClient) -> None:
    from app.services import auth_throttle

    auth_throttle.reset()
    email = _email()
    for _ in range(auth_throttle.LIMIT):
        assert _login(client, email, "wrong-password", xff="203.0.113.10").status_code == 401
    assert _login(client, email, "wrong-password", xff="203.0.113.10").status_code == 429
    # Другой клиент за доверенным прокси (свой XFF) — независимый лимит
    assert _login(client, email, "wrong-password", xff="203.0.113.11").status_code == 401


def test_xff_spoof_rotation_does_not_bypass(client: TestClient) -> None:
    from app.services import auth_throttle

    auth_throttle.reset()
    email = _email()
    # Клиент контролирует всю цепочку XFF и может ротировать первые хопы;
    # ключ лимита от этого меняться не должен
    for i in range(auth_throttle.LIMIT):
        status = _login(
            client, email, "wrong-password", xff=f"203.0.113.{20 + i}, 10.0.0.9"
        ).status_code
        assert status == 401
    assert (
        _login(client, email, "wrong-password", xff="198.51.100.1, 10.0.0.9").status_code == 429
    )


def test_x_real_ip_wins_over_forwarded_for(client: TestClient) -> None:
    from app.services import auth_throttle

    auth_throttle.reset()
    email = _email()
    # X-Real-IP ставит сам nginx — он определяет ключ; любые XFF игнорируются
    for i in range(auth_throttle.LIMIT):
        status = _login(
            client,
            email,
            "wrong-password",
            xff=f"203.0.113.{30 + i}, 10.0.0.{i}",
            x_real_ip="198.51.100.77",
        ).status_code
        assert status == 401
    assert (
        _login(
            client,
            email,
            "wrong-password",
            xff="203.0.113.99, 10.0.0.99",
            x_real_ip="198.51.100.77",
        ).status_code
        == 429
    )
    # Другой X-Real-IP — независимый лимит
    assert _login(client, email, "wrong-password", x_real_ip="198.51.100.78").status_code == 401
