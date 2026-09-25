"""Базовые security-заголовки на каждом ответе API (R05, OWASP-базовая линия)."""

from __future__ import annotations

from fastapi.testclient import TestClient

CORS_ORIGIN = "http://localhost:3000"
API_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")
API_HEADERS = ("Authorization", "Content-Type")


def test_security_headers_present(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"


def test_cors_preflight_allows_only_api_methods(client: TestClient) -> None:
    for method in API_METHODS:
        response = client.options(
            "/api/v1/health",
            headers={
                "Origin": CORS_ORIGIN,
                "Access-Control-Request-Method": method,
            },
        )

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == CORS_ORIGIN
        assert response.headers["access-control-allow-credentials"] == "true"
        assert set(response.headers["access-control-allow-methods"].split(", ")) == set(API_METHODS)

    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": CORS_ORIGIN,
            "Access-Control-Request-Method": "TRACE",
        },
    )

    assert response.status_code == 400
    assert response.text == "Disallowed CORS method"


def test_cors_preflight_allows_api_headers(client: TestClient) -> None:
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": CORS_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": ", ".join(API_HEADERS),
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == CORS_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"
    allowed_headers = set(response.headers["access-control-allow-headers"].split(", "))
    assert set(API_HEADERS).issubset(allowed_headers)

    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": CORS_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "X-Admin-Override",
        },
    )

    assert response.status_code == 400
