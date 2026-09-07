"""Шов живых проб (таск 02, R03): три эталонные ошибки в обеих локалях.

Код — в заголовке X-Error-Code, тело detail — строка на языке запроса,
без заголовка — русский (текущее поведение).
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.support import register_test_user


def _token(client: TestClient) -> str:
    data = register_test_user(
        client,
        email=f"locale-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Локальный",
        role_slug="gk_customer",
    )
    return data["access_token"]


def test_invalid_login_en_is_english_with_stable_code(client: TestClient) -> None:
    headers = {"Accept-Language": "en"}
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": f"no-such-{uuid.uuid4().hex[:8]}@example.com",
            "password": "Wrong12345",
        },
        headers=headers,
    )
    assert response.status_code == 401
    assert response.headers.get("X-Error-Code") == "AUTH_INVALID"
    assert response.json()["detail"] == "Invalid email or password"


def test_invalid_login_ru_default_without_language_header(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": f"no-such-{uuid.uuid4().hex[:8]}@example.com",
            "password": "Wrong12345",
        },
    )
    assert response.status_code == 401
    assert response.headers.get("X-Error-Code") == "AUTH_INVALID"
    assert response.json()["detail"] == "Неверный email или пароль"


def test_no_token_ru_and_en_with_stable_code(client: TestClient) -> None:
    plain = client.get("/api/v1/projects")
    assert plain.status_code == 401
    assert plain.headers.get("X-Error-Code") == "AUTH_REQUIRED"
    assert plain.json()["detail"] == "Не авторизован"
    english = client.get("/api/v1/projects", headers={"Accept-Language": "en"})
    assert english.status_code == 401
    assert english.headers.get("X-Error-Code") == "AUTH_REQUIRED"
    assert english.json()["detail"] == "Authentication required"


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ({}, "Для ответа «Неприменимо» нужно указать обоснование."),
        (
            {"Accept-Language": "en"},
            "An answer 'Not applicable' requires justification.",
        ),
    ],
)
def test_validation_code_translated_by_locale(
    client: TestClient, headers: dict[str, str], expected: str
) -> None:
    """Код каталога из pydantic-валидатора — текст на языке запроса (ru default)."""
    token = _token(client)
    request_headers = {"Authorization": f"Bearer {token}", **headers}
    response = client.post(
        "/api/v1/assessments",
        headers=request_headers,
        json={
            "name": "Проверка локали",
            "answers": [
                {"checkpoint_code": "R01", "status": "not_applicable"},
            ],
        },
    )
    assert response.status_code == 422
    details = response.json()["detail"]
    assert isinstance(details, list) and details
    assert details[0]["msg"] == expected


def test_registry_limits_live_in_settings_with_old_defaults() -> None:
    """Лимиты реестра — в settings с прежними дефолтами (R02i)."""
    from app.core.config import settings

    assert settings.registry_auth_limit == 10000
    assert settings.registry_window_seconds == 60.0
    assert settings.registry_max_entries == 5000


def test_registry_auth_limit_from_settings_is_enforced(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Переопределение лимита через settings режет аутентифицированные запросы."""
    monkeypatch.setattr("app.core.config.settings.registry_auth_limit", 0)
    response = client.get(
        "/api/v1/nioktr", headers={"Authorization": f"Bearer {_token(client)}"}
    )
    assert response.status_code == 429
    assert response.headers.get("X-Error-Code") == "REGISTRY_RATE_LIMITED"


def test_registry_limit_ru_and_en_with_stable_code(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.core.config.settings.registry_anon_limit", 0)
    plain = client.get("/api/v1/nioktr")
    assert plain.status_code == 429
    assert plain.headers.get("X-Error-Code") == "REGISTRY_RATE_LIMITED"
    assert plain.json()["detail"] == "Слишком много запросов к реестру, попробуйте позже"
    english = client.get("/api/v1/nioktr", headers={"Accept-Language": "en"})
    assert english.status_code == 429
    assert english.headers.get("X-Error-Code") == "REGISTRY_RATE_LIMITED"
    assert english.json()["detail"] == "Too many registry requests, please try again later"
