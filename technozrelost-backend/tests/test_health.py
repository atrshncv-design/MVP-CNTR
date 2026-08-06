from fastapi.testclient import TestClient

from app.api.v1 import health as health_module
from app.main import app

client = TestClient(app)


def test_health_reports_service_identity() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "technozrelost-backend",
    }


def test_openapi_exposes_health_contract() -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/api/v1/health" in response.json()["paths"]


def test_ready_reports_checked_database_roles(monkeypatch) -> None:
    async def databases_ready() -> dict[str, str]:
        return {"primary": "ok", "replica": "not_configured"}

    monkeypatch.setattr(health_module, "check_databases", databases_ready)

    response = client.get("/api/v1/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "databases": {"primary": "ok", "replica": "not_configured"},
    }


def test_ready_fails_closed_when_database_check_fails(monkeypatch) -> None:
    async def databases_unavailable() -> dict[str, str]:
        return {"primary": "unavailable", "replica": "not_configured"}

    monkeypatch.setattr(health_module, "check_databases", databases_unavailable)

    response = client.get("/api/v1/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == {
        "status": "not_ready",
        "databases": {"primary": "unavailable", "replica": "not_configured"},
    }
