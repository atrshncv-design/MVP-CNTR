"""Базовые security-заголовки на каждом ответе API (R05, OWASP-базовая линия)."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_security_headers_present(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
