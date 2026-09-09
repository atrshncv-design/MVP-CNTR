"""P2-пакет (таск 14, R06i): пагинация, N+1, CHECK, readiness, секреты.

Шов — публичная HTTP-граница API плюс миграции (CHECK) и прод-guard
конфигурации. Каждый тест идёт через HTTP или Settings/БД-миграцию.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    email = f"p2-{uuid.uuid4().hex[:8]}@example.com"
    data = register_test_user(
        client, email=email, full_name="P2 User", role_slug=role,
    )
    return data["access_token"], data["user"]["id"]


def test_users_list_paginates_with_limit_offset(client: TestClient) -> None:
    """GET /users поддерживает limit/offset: limit=1 отдаёт ровно одну запись."""
    admin_token, _ = _register(client, "cntr_admin")
    _register(client)
    _register(client)
    first = client.get("/api/v1/users?limit=1&offset=0", headers=_auth(admin_token))
    assert first.status_code == 200, first.text
    assert len(first.json()) == 1
    second = client.get("/api/v1/users?limit=1&offset=1", headers=_auth(admin_token))
    assert second.status_code == 200, second.text
    assert len(second.json()) == 1
    assert first.json()[0]["id"] != second.json()[0]["id"]


def test_admin_audit_paginates_with_offset(client: TestClient) -> None:
    """GET /admin/audit поддерживает offset: страницы limit=1 не пересекаются."""
    admin_token, _ = _register(client, "cntr_admin")
    owner_token, _ = _register(client)
    for name in ("P2 audit proj A", "P2 audit proj B"):
        project = client.post(
            "/api/v1/projects",
            json={"name": name, "target_level": 9},
            headers=_auth(owner_token),
        )
        assert project.status_code in (200, 201), project.text
    page0 = client.get(
        "/api/v1/admin/audit?limit=1&offset=0", headers=_auth(admin_token)
    )
    assert page0.status_code == 200, page0.text
    assert len(page0.json()) == 1
    page1 = client.get(
        "/api/v1/admin/audit?limit=1&offset=1", headers=_auth(admin_token)
    )
    assert page1.status_code == 200, page1.text
    assert len(page1.json()) == 1
    assert page0.json()[0]["id"] != page1.json()[0]["id"]


def test_join_requests_paginate_with_limit_offset(client: TestClient) -> None:
    """GET join-requests поддерживает limit/offset (P2): limit=2 из 3 pending."""
    owner_token, _ = _register(client)
    project = client.post(
        "/api/v1/projects",
        json={"name": "P2 join pag", "target_level": 6},
        headers=_auth(owner_token),
    )
    assert project.status_code == 201, project.text
    pid = project.json()["id"]
    token = project.json()["join_token"]
    for _ in range(3):
        joiner_token, _ = _register(client)
        join = client.post(
            "/api/v1/projects/join",
            json={"token": token, "role_in_project": "participant"},
            headers=_auth(joiner_token),
        )
        assert join.status_code == 200, join.text
        assert join.json()["status"] == "pending"
    page0 = client.get(
        f"/api/v1/projects/{pid}/join-requests?limit=2&offset=0",
        headers=_auth(owner_token),
    )
    assert page0.status_code == 200, page0.text
    assert len(page0.json()) == 2
    page1 = client.get(
        f"/api/v1/projects/{pid}/join-requests?limit=2&offset=2",
        headers=_auth(owner_token),
    )
    assert page1.status_code == 200, page1.text
    assert len(page1.json()) == 1


def test_project_requests_history_paginates(client: TestClient) -> None:
    """GET /projects/{id}/requests поддерживает limit/offset (P2)."""
    owner_token, _ = _register(client)
    project = client.post(
        "/api/v1/projects",
        json={"name": "P2 req hist", "target_level": 6},
        headers=_auth(owner_token),
    )
    assert project.status_code == 201, project.text
    pid = project.json()["id"]
    resp = client.get(
        f"/api/v1/projects/{pid}/requests?limit=1&offset=0",
        headers=_auth(owner_token),
    )
    # Истории может не быть — шов обязан принять пагинацию, а не 422.
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json(), list)
    assert len(resp.json()) <= 1


def test_join_requests_constant_query_count(client: TestClient) -> None:
    """100 заявок вступающих (здесь 20) — константное число запросов к БД.

    Шов HTTP: счётчик курсорных выполнений на engine; bound не зависит от N.
    """
    import os

    import psycopg
    from sqlalchemy import event

    from app.core.database import engine as async_engine

    owner_token, owner_id = _register(client)
    project = client.post(
        "/api/v1/projects",
        json={"name": "P2 join n1", "target_level": 6},
        headers=_auth(owner_token),
    )
    assert project.status_code == 201, project.text
    pid = project.json()["id"]

    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        # Разные пригласившие: identity-map не схлопнет N+1 в один запрос.
        inviters = [
            conn.execute(
                "INSERT INTO public.users (email, password_hash, full_name) "
                "VALUES (%s, %s, %s) RETURNING id",
                (f"p2inv-{uuid.uuid4().hex[:8]}-{i}@example.com", "x", f"Inviter {i}"),
            ).fetchone()[0]
            for i in range(10)
        ]
        for i in range(20):
            uid = conn.execute(
                "INSERT INTO public.users (email, password_hash, full_name) "
                "VALUES (%s, %s, %s) RETURNING id",
                (f"p2n1-{uuid.uuid4().hex[:8]}-{i}@example.com", "x", f"N1 User {i}"),
            ).fetchone()[0]
            invited = inviters[i % 10] if i % 2 == 0 else None
            conn.execute(
                "INSERT INTO public.project_members "
                "(project_id, user_id, role_in_project, status, invited_by) "
                "VALUES (%s, %s, %s, 'pending', %s)",
                (pid, uid, "participant", invited),
            )
    finally:
        conn.close()

    calls: list[str] = []
    sync_engine = async_engine.sync_engine

    def _count(conn_, cursor, statement, parameters, context, executemany) -> None:
        calls.append(statement.split()[0])

    event.listen(sync_engine, "before_cursor_execute", _count)
    try:
        resp = client.get(
            f"/api/v1/projects/{pid}/join-requests?limit=100&offset=0",
            headers=_auth(owner_token),
        )
    finally:
        event.remove(sync_engine, "before_cursor_execute", _count)
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert len(rows) == 20
    assert sum(1 for r in rows if r["invited_by_name"]) == 10
    # Константа: очередь (1) + пригласившие (1) + доступ/авторизация (≤5).
    assert len(calls) <= 8, f"too many statements for 20 rows: {len(calls)}"


def test_invalid_statuses_rejected_by_check(client: TestClient) -> None:
    """CHECK жизненных циклов (P2): невалидный статус проекта/документа/заявки/КТ.

    Шов миграций: прямая вставка через SQL обязана упасть CheckViolation.
    """
    import os

    import psycopg
    from psycopg import errors as pg_errors

    owner_token, _ = _register(client)
    project = client.post(
        "/api/v1/projects",
        json={"name": "P2 check proj", "target_level": 6},
        headers=_auth(owner_token),
    )
    assert project.status_code == 201, project.text
    pid = project.json()["id"]

    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    bad = [
        (
            "projects",
            "INSERT INTO public.projects (name, join_token, status) "
            "VALUES ('bad', %s, 'nope')",
            (f"BAD-{uuid.uuid4().hex[:8]}",),
        ),
        (
            "project_documents",
            "INSERT INTO public.project_documents (project_id, title, doc_type, status) "
            "VALUES (%s, 'bad', 'file', 'nope')",
            (pid,),
        ),
        (
            "promotion_requests",
            "INSERT INTO public.promotion_requests (project_id, from_level, to_level, status) "
            "VALUES (%s, 1, 2, 'nope')",
            (pid,),
        ),
        (
            "control_points",
            "INSERT INTO public.control_points (project_id, title, status) "
            "VALUES (%s, 'bad', 'nope')",
            (pid,),
        ),
    ]
    try:
        for table, sql, params in bad:
            try:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
            except pg_errors.CheckViolation:
                continue
            raise AssertionError(f"{table} CHECK missing: status 'nope' accepted")
    finally:
        conn.close()


def test_readiness_reports_storage_and_clamav(client: TestClient) -> None:
    """Readiness включает зависимости (P2): storage/clamav в ответе, падение — 503."""
    resp = client.get("/api/v1/ready")
    assert resp.status_code in (200, 503), resp.text
    payload = resp.json() if resp.status_code == 200 else resp.json()["detail"]
    assert payload["storage"] in ("ok", "unavailable"), payload
    assert payload["clamav"] in ("ok", "unavailable", "disabled"), payload


def test_readiness_fails_closed_when_storage_down(client: TestClient, monkeypatch) -> None:
    """Падение хранилища даёт 503 на readiness (P2, fail-closed)."""
    from app.api.v1 import health as health_module

    async def storage_down() -> str:
        return "unavailable"

    async def databases_ok() -> dict[str, str]:
        return {"primary": "ok", "replica": "not_configured"}

    monkeypatch.setattr(health_module, "check_databases", databases_ok)
    monkeypatch.setattr(health_module, "check_storage", storage_down)
    resp = client.get("/api/v1/ready")
    assert resp.status_code == 503, resp.text


def test_readiness_fails_closed_when_clamav_down(client: TestClient, monkeypatch) -> None:
    """Падение скана даёт 503 на readiness (P2, fail-closed)."""
    from app.api.v1 import health as health_module

    async def clamav_down() -> str:
        return "unavailable"

    async def databases_ok() -> dict[str, str]:
        return {"primary": "ok", "replica": "not_configured"}

    async def storage_ok() -> str:
        return "ok"

    monkeypatch.setattr(health_module, "check_databases", databases_ok)
    monkeypatch.setattr(health_module, "check_storage", storage_ok)
    monkeypatch.setattr(health_module, "check_clamav", clamav_down)
    resp = client.get("/api/v1/ready")
    assert resp.status_code == 503, resp.text


def test_production_rejects_default_dev_passwords() -> None:
    """Dev-пароли change_me не проходят прод-валидацию (P2)."""
    import pytest
    from pydantic import ValidationError

    from app.core.config import Settings

    with pytest.raises(ValidationError, match="postgres_password"):
        Settings(
            app_env="production",
            jwt_secret="x" * 48,
            redis_url="redis://redis:6379/0",
            postgres_password="change_me",
            minio_secret_key="s" * 16,
            _env_file=None,
        )
    with pytest.raises(ValidationError, match="minio_secret_key"):
        Settings(
            app_env="production",
            jwt_secret="x" * 48,
            redis_url="redis://redis:6379/0",
            postgres_password="p" * 16,
            minio_secret_key="change_me",
            _env_file=None,
        )
