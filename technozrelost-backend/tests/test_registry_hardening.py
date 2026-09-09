"""Таск 05 (R05i, истории 9/11): честные лимиты реестров и закрытый дамп ПДн.

Шов — публичная HTTP-граница. Изоляция бакетов — уникальным X-Real-IP.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.support import register_test_user


def _ip(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _token(client: TestClient) -> str:
    data = register_test_user(
        client,
        email=f"hard-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Честный Лимит",
        role_slug="gk_customer",
    )
    return data["access_token"]


def test_fake_authorization_header_keeps_anon_limit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Поддельный Authorization без валидного токена — anon-лимит (история 9)."""
    monkeypatch.setattr("app.core.config.settings.registry_anon_limit", 0)
    response = client.get(
        "/api/v1/nioktr",
        headers={"X-Real-IP": _ip("fake"), "Authorization": "Bearer forged.invalid.token"},
    )
    assert response.status_code == 429
    assert response.headers.get("X-Error-Code") == "REGISTRY_RATE_LIMITED"


def test_valid_token_gets_auth_limit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Валидный токен даёт auth-лимит: anon закрыт, auth открыт (история 9)."""
    monkeypatch.setattr("app.core.config.settings.registry_anon_limit", 0)
    token = _token(client)
    anon = client.get("/api/v1/nioktr", headers={"X-Real-IP": _ip("cls")})
    assert anon.status_code == 429
    authed = client.get(
        "/api/v1/nioktr",
        headers={"X-Real-IP": _ip("cls"), "Authorization": f"Bearer {token}"},
    )
    assert authed.status_code == 200


def test_anonymous_specialists_bounded_paginated_and_rate_limited(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Аноним: specialists ≤100 с пагинацией и rate-limit, без дампа (история 11)."""
    page = client.get(
        "/api/v1/executors/specialists", headers={"X-Real-IP": _ip("spec")}
    )
    assert page.status_code == 200
    assert len(page.json()) <= 100
    one = client.get(
        "/api/v1/executors/specialists?limit=1", headers={"X-Real-IP": _ip("spec")}
    )
    assert one.status_code == 200
    assert len(one.json()) <= 1
    too_much = client.get(
        "/api/v1/executors/specialists?limit=1000", headers={"X-Real-IP": _ip("spec")}
    )
    assert too_much.status_code == 422
    monkeypatch.setattr("app.core.config.settings.registry_anon_limit", 0)
    flooded = client.get(
        "/api/v1/executors/specialists", headers={"X-Real-IP": _ip("spec")}
    )
    assert flooded.status_code == 429
    assert flooded.headers.get("X-Error-Code") == "REGISTRY_RATE_LIMITED"


def test_no_unbounded_registry_lists(client: TestClient) -> None:
    """Полная выборка без LIMIT закрыта: огромный limit → 422 на всех списках."""
    ip = {"X-Real-IP": _ip("cap")}
    assert client.get("/api/v1/nioktr?limit=10000", headers=ip).status_code == 422
    assert (
        client.get("/api/v1/nioktr/organizations?limit=10000", headers=ip).status_code
        == 422
    )
    assert client.get("/api/v1/executors?limit=1000", headers=ip).status_code == 422
    assert (
        client.get("/api/v1/executors/specialists?limit=1000", headers=ip).status_code
        == 422
    )
    assert (
        client.get("/api/v1/executors/organizations?limit=1000", headers=ip).status_code
        == 422
    )
    assert (
        client.get("/api/v1/projects/registry?limit=1000", headers=ip).status_code
        == 422
    )


def test_fake_header_on_specialists_and_registry_keep_anon_limit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Обход лимита поддельным заголовком закрыт везде, не только на /nioktr."""
    monkeypatch.setattr("app.core.config.settings.registry_anon_limit", 0)
    forged = {"Authorization": "Bearer forged.invalid.token"}
    for path in (
        "/api/v1/executors/specialists",
        "/api/v1/executors",
        "/api/v1/executors/organizations",
        "/api/v1/projects/registry",
    ):
        response = client.get(
            path, headers={"X-Real-IP": _ip("bypass"), **forged}
        )
        assert response.status_code == 429, path
        assert response.headers.get("X-Error-Code") == "REGISTRY_RATE_LIMITED", path
