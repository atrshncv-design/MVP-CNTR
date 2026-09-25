from __future__ import annotations

from fastapi.testclient import TestClient

DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


def test_production_app_disables_docs_and_openapi(monkeypatch) -> None:
    import app.main as main

    monkeypatch.setattr(main.settings, "app_env", "production")
    app = main.create_app()
    client = TestClient(app)
    try:
        for path in DOCS_PATHS:
            response = client.get(path)
            assert response.status_code == 404, path
    finally:
        client.close()


def test_dev_and_test_apps_keep_docs_and_openapi(monkeypatch) -> None:
    import app.main as main

    for app_env in ("dev", "test"):
        monkeypatch.setattr(main.settings, "app_env", app_env)
        app = main.create_app()
        client = TestClient(app)
        try:
            for path in DOCS_PATHS:
                response = client.get(path)
                assert response.status_code == 200, (app_env, path)
        finally:
            client.close()
