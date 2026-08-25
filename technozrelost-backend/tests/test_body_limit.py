"""Глобальный лимит тела запроса (R05.5): oversize → 413 до обработчика."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def _email() -> str:
    return f"body-{uuid.uuid4().hex[:8]}@example.com"


def test_oversized_body_rejected_with_413(client: TestClient, monkeypatch) -> None:
    import app.main as main_mod

    monkeypatch.setattr(main_mod, "max_request_body_bytes", 128)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": _email(), "password": "x" * 512},
    )
    assert response.status_code == 413


def test_normal_body_passes_through(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": _email(), "password": "no-such-user"},
    )
    assert response.status_code == 401
