"""Тикет 05 (operations-modules): операционная аналитика сотрудников Центра.

Покрытие:
- Воспроизводимость: повторный вызов → те же числа; сверка 2-3 показателей
  с прямым SQL-подсчётом (psycopg).
- RBAC: /admin/analytics и /admin/analytics/export доступны ТОЛЬКО
  cntr_admin/cntr_manager; внешние роли (gk_customer, rd_executor) → 403.
- Метаданные: каждый показатель имеет definition/source/computed_at.
- Экспорт: staff получает CSV/JSON; внешний → 403; в экспорте нет PII
  (агрегаты, без списков пользователей/email).
- Фильтры: period_from/to (по created_at), status (по projects.status).
- tech_requests: таблицы — зависимость requests-matching/02 (в этом worktree
  отсутствуют); сервис детектирует схему и при отсутствии таблиц возвращает 0
  с честными метаданными. Тесты создают таблицы-зеркала в тест-БД и проверяют
  реальный подсчёт + SQL-сверку.

Ключевое решение: показатели считаются ТОЛЬКО SQL-агрегатами по данным БД
(без LLM), формулы детерминированные — те же данные → те же числа.
"""

from __future__ import annotations

import os
import uuid
from datetime import date, timedelta

import psycopg
import pytest
from fastapi.testclient import TestClient

from tests.support import register_test_user

TODAY = date.today()

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _register(client: TestClient, role: str = "gk_customer") -> dict:
    return register_test_user(
        client,
        email=f"{_uniq('user')}@example.com",
        full_name="Тест Аналитика",
        role_slug=role,
    )


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str, target_level: int = 9) -> int:
    resp = client.post(
        "/api/v1/projects",
        headers=_auth(token),
        json={"name": _uniq("Проект"), "target_level": target_level},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _publish_project(client: TestClient, mgr_token: str, project_id: int) -> None:
    """Очередь менеджера: approve черновика → published."""
    drafts = client.get("/api/v1/manager/queue/drafts", headers=_auth(mgr_token))
    assert drafts.status_code == 200, drafts.text
    draft = next((d for d in drafts.json() if d["id"] == project_id), None)
    assert draft is not None, f"проект {project_id} не в очереди менеджера"
    decided = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True, "comment": "ок"},
    )
    assert decided.status_code == 200, decided.text


def _create_stage(client: TestClient, token: str, project_id: int) -> int:
    resp = client.post(
        f"/api/v1/projects/{project_id}/stages",
        headers=_auth(token),
        json={"title": _uniq("Этап")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_task(
    client: TestClient,
    token: str,
    stage_id: int,
    due_date: str | None = None,
) -> int:
    body: dict = {"title": _uniq("Задача")}
    if due_date is not None:
        body["due_date"] = due_date
    resp = client.post(
        f"/api/v1/stages/{stage_id}/tasks",
        headers=_auth(token),
        json=body,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_checkpoint(
    client: TestClient,
    token: str,
    stage_id: int,
    due_date: str | None = None,
) -> int:
    body: dict = {"title": _uniq("КТ")}
    if due_date is not None:
        body["due_date"] = due_date
    resp = client.post(
        f"/api/v1/stages/{stage_id}/checkpoints",
        headers=_auth(token),
        json=body,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_org(client: TestClient, token: str) -> int:
    resp = client.post(
        "/api/v1/orgs",
        headers=_auth(token),
        json={"name": _uniq("Организация")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _submit_org(client: TestClient, token: str, org_id: int) -> None:
    resp = client.post(f"/api/v1/orgs/{org_id}/submit", headers=_auth(token))
    assert resp.status_code == 200, resp.text


def _verify_org(client: TestClient, mgr_token: str, org_id: int) -> None:
    resp = client.post(
        f"/api/v1/manager/orgs/{org_id}/decide",
        headers=_auth(mgr_token),
        json={"action": "verify", "comment": "ок"},
    )
    assert resp.status_code == 200, resp.text


def _db() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


# Таблицы-зеркала requests-matching/02 (минимальная схема для метрик).
_TECH_REQUESTS_DDL = """
CREATE TABLE IF NOT EXISTS public.tech_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_by BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    requirements TEXT NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    visibility VARCHAR(16) NOT NULL DEFAULT 'platform',
    moderation_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tech_request_moderation_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id BIGINT NOT NULL,
    action VARCHAR(32) NOT NULL,
    moderator_id BIGINT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


@pytest.fixture()
def tech_tables() -> None:
    """Создаёт таблицы-зеркала tech_requests в тест-БД и чистит их.

    Если таблицы уже существуют (общая тест-БД, requests-matching прогнал
    свои тесты) — CREATE IF NOT EXISTS no-op, TRUNCATE чистит данные.
    """
    conn = _db()
    try:
        conn.execute(_TECH_REQUESTS_DDL)
        conn.execute(
            "TRUNCATE TABLE public.tech_request_documents, "
            "public.tech_request_moderation_log, "
            "public.tech_requests RESTART IDENTITY CASCADE"
        )
        # Интеграционный контур: tech_requests — настоящая таблица с FK на
        # users/user_organizations (requests-миграция 0031). После TRUNCATE
        # RESTART IDENTITY id=1 гарантирован — сидируем родительские строки.
        conn.execute(
            "INSERT INTO public.users (email, password_hash, full_name, status, is_active) "
            "VALUES ('analytics-seed@example.com', 'x', 'Seed', 'verified', true)"
        )
        conn.execute(
            "INSERT INTO public.user_organizations (name, created_by) VALUES ('Seed Org', 1)"
        )
    finally:
        conn.close()
    yield
    conn = _db()
    try:
        conn.execute(
            "TRUNCATE TABLE public.tech_request_documents, "
            "public.tech_request_moderation_log, "
            "public.tech_requests RESTART IDENTITY CASCADE"
        )
    finally:
        conn.close()


def _insert_tech_request(
    *,
    status: str = "draft",
    visibility: str = "platform",
    moderation_status: str = "pending",
    created_by: int = 1,
    org_id: int = 1,
    created_at: str | None = None,
) -> None:
    conn = _db()
    try:
        ts = created_at or "now()"
        conn.execute(
            "INSERT INTO public.tech_requests "
            "(created_by, organization_id, title, requirements, deadline, "
            "status, visibility, moderation_status, created_at) "
            f"VALUES (%s, %s, %s, %s, now(), %s, %s, %s, {ts})",
            (
                created_by,
                org_id,
                _uniq("Запрос"),
                "требования",
                status,
                visibility,
                moderation_status,
            ),
        )
    finally:
        conn.close()


def _insert_moderation_log(action: str, request_id: int = 1) -> None:
    conn = _db()
    try:
        conn.execute(
            "INSERT INTO public.tech_request_moderation_log "
            "(request_id, action, reason) VALUES (%s, %s, %s)",
            (request_id, action, "причина"),
        )
    finally:
        conn.close()


def _summary(client: TestClient, token: str, **params: str | None) -> dict:
    resp = client.get("/api/v1/admin/analytics", headers=_auth(token), params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ─── Воспроизводимость + SQL-сверка ─────────────────────────────────────────

def test_reproducible_and_matches_sql(client: TestClient) -> None:
    """Повторный вызов → те же числа; 3 показателя сверены с прямым SQL."""
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    pid1 = _create_project(client, owner["access_token"], target_level=5)
    _publish_project(client, mgr["access_token"], pid1)

    org1 = _create_org(client, owner["access_token"])
    _submit_org(client, owner["access_token"], org1)
    _verify_org(client, mgr["access_token"], org1)

    stage = _create_stage(client, owner["access_token"], pid1)
    _create_task(client, owner["access_token"], stage, (TODAY - timedelta(days=1)).isoformat())
    _create_task(client, owner["access_token"], stage)
    _create_checkpoint(
        client, owner["access_token"], stage, (TODAY - timedelta(days=2)).isoformat()
    )
    _create_checkpoint(client, owner["access_token"], stage)

    first = _summary(client, mgr["access_token"])
    second = _summary(client, mgr["access_token"])

    # Воспроизводимость: value каждого показателя одинаков при повторе.
    for key, m in first["metrics"].items():
        assert second["metrics"][key]["value"] == m["value"], key

    # SQL-сверка (прямой подсчёт).
    conn = _db()
    try:
        projects_total = conn.execute(
            "SELECT count(*) FROM public.projects"
        ).fetchone()[0]
        orgs_verified = conn.execute(
            "SELECT count(*) FROM public.user_organizations WHERE state = 'verified'"
        ).fetchone()[0]
        tasks_overdue = conn.execute(
            "SELECT count(*) FROM public.stage_tasks "
            "WHERE due_date < %s AND status != 'done'",
            (TODAY,),
        ).fetchone()[0]
    finally:
        conn.close()

    assert first["metrics"]["projects_total"]["value"] == projects_total
    assert first["metrics"]["organizations_verified"]["value"] == orgs_verified
    assert first["metrics"]["tasks_overdue"]["value"] == tasks_overdue


def test_tech_requests_metrics_with_tables(client: TestClient, tech_tables: None) -> None:
    """tech_requests: реальный подсчёт при наличии таблиц (SQL-сверка)."""
    mgr = _register(client, "cntr_manager")
    _insert_tech_request(status="submitted", visibility="public", moderation_status="approved")
    _insert_tech_request(status="submitted", visibility="platform", moderation_status="pending")
    _insert_tech_request(status="draft", visibility="private", moderation_status="pending")
    _insert_moderation_log("approve", 1)
    _insert_moderation_log("reject", 2)

    summary = _summary(client, mgr["access_token"])
    m = summary["metrics"]
    assert m["tech_requests_total"]["value"] == 3
    assert m["tech_requests_submitted"]["value"] == 2
    assert m["tech_requests_approved"]["value"] == 1
    assert m["tech_requests_by_visibility"]["value"] == {
        "public": 1,
        "platform": 1,
        "private": 1,
    }
    assert m["manager_decisions_approve"]["value"] == 1
    assert m["manager_decisions_reject"]["value"] == 1

    conn = _db()
    try:
        sql_total = conn.execute(
            "SELECT count(*) FROM public.tech_requests"
        ).fetchone()[0]
        sql_approved = conn.execute(
            "SELECT count(*) FROM public.tech_requests "
            "WHERE moderation_status = 'approved'"
        ).fetchone()[0]
    finally:
        conn.close()
    assert m["tech_requests_total"]["value"] == sql_total
    assert m["tech_requests_approved"]["value"] == sql_approved


def test_metrics_zero_without_dependency_tables(client: TestClient) -> None:
    """Без таблиц requests-matching метрики = 0 (честно), метаданные есть."""
    conn = _db()
    try:
        has_table = (
            conn.execute(
                "SELECT to_regclass('public.tech_requests')"
            ).fetchone()[0]
            is not None
        )
    finally:
        conn.close()
    if has_table:
        pytest.skip("tech_requests уже существует в общей тест-БД")

    mgr = _register(client, "cntr_manager")
    summary = _summary(client, mgr["access_token"])
    m = summary["metrics"]
    assert m["tech_requests_total"]["value"] == 0
    assert m["tech_requests_submitted"]["value"] == 0
    assert m["tech_requests_approved"]["value"] == 0
    assert m["manager_decisions_approve"]["value"] == 0
    assert m["manager_decisions_reject"]["value"] == 0
    assert m["tech_requests_total"]["source"] == "tech_requests.id"
    assert m["manager_decisions_approve"]["source"] == "tech_request_moderation_log.action"


# ─── RBAC: внешние роли → 403 ────────────────────────────────────────────────

@pytest.mark.parametrize("role", ["gk_customer", "rd_executor"])
def test_external_roles_forbidden_on_summary(client: TestClient, role: str) -> None:
    external = _register(client, role)
    for url in ("/api/v1/admin/analytics", "/api/v1/admin/analytics/export"):
        resp = client.get(url, headers=_auth(external["access_token"]))
        assert resp.status_code == 403, (url, resp.status_code, resp.text)


@pytest.mark.parametrize("role", ["gk_customer", "rd_executor"])
def test_external_roles_forbidden_on_export(client: TestClient, role: str) -> None:
    external = _register(client, role)
    for fmt in ("json", "csv"):
        resp = client.get(
            "/api/v1/admin/analytics/export",
            headers=_auth(external["access_token"]),
            params={"format": fmt},
        )
        assert resp.status_code == 403, (fmt, resp.status_code, resp.text)


def test_anonymous_forbidden(client: TestClient) -> None:
    resp = client.get("/api/v1/admin/analytics")
    assert resp.status_code == 401


def test_staff_roles_allowed(client: TestClient) -> None:
    for role in ("cntr_admin", "cntr_manager"):
        staff = _register(client, role)
        resp = client.get(
            "/api/v1/admin/analytics", headers=_auth(staff["access_token"])
        )
        assert resp.status_code == 200, (role, resp.text)


# ─── Метаданные показателей ─────────────────────────────────────────────────

def test_every_metric_has_metadata(client: TestClient) -> None:
    mgr = _register(client, "cntr_manager")
    summary = _summary(client, mgr["access_token"])
    assert summary["computed_at"]
    assert summary["filters"]["period_from"] is None
    assert summary["filters"]["period_to"] is None
    assert summary["filters"]["status"] is None

    assert len(summary["metrics"]) >= 18
    for key, m in summary["metrics"].items():
        assert m["definition"], key
        assert m["source"], key
        assert m["computed_at"], key
        assert m["computed_at"] == summary["computed_at"], key


# ─── Экспорт: staff получает, без PII ───────────────────────────────────────

def test_export_json_staff_no_pii(client: TestClient) -> None:
    mgr = _register(client, "cntr_manager")
    owner = _register(client)
    _create_project(client, owner["access_token"])
    _create_org(client, owner["access_token"])

    resp = client.get(
        "/api/v1/admin/analytics/export",
        headers=_auth(mgr["access_token"]),
        params={"format": "json"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["metrics"]["projects_total"]["value"] >= 1
    # Нет PII: ни списков пользователей, ни email.
    raw = resp.text
    assert "@example.com" not in raw
    assert "full_name" not in raw
    assert "email" not in raw


def test_export_csv_staff_no_pii(client: TestClient) -> None:
    mgr = _register(client, "cntr_manager")
    owner = _register(client)
    _create_project(client, owner["access_token"])

    resp = client.get(
        "/api/v1/admin/analytics/export",
        headers=_auth(mgr["access_token"]),
        params={"format": "csv"},
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers["content-disposition"]
    lines = resp.text.strip().splitlines()
    assert lines[0] == "metric,value,definition,source,computed_at"
    assert any(line.startswith("projects_total,") for line in lines)
    assert "@example.com" not in resp.text


# ─── Фильтры ─────────────────────────────────────────────────────────────────

def test_filters_period_and_status(client: TestClient) -> None:
    owner = _register(client)
    mgr = _register(client, "cntr_manager")
    pid_a = _create_project(client, owner["access_token"], target_level=5)
    _publish_project(client, mgr["access_token"], pid_a)

    # Старый проект (created_at в прошлом) — через SQL.
    conn = _db()
    try:
        conn.execute(
            "INSERT INTO public.projects "
            "(name, target_level, current_level, status, join_token, created_at) "
            "VALUES (%s, 7, 0, 'draft', %s, '2024-01-15T10:00:00+00:00')",
            (_uniq("Старый"), _uniq("TZ")),
        )
    finally:
        conn.close()

    # status-фильтр: только published.
    summary = _summary(client, mgr["access_token"], status="published")
    assert summary["metrics"]["projects_total"]["value"] == 1
    assert summary["metrics"]["projects_by_status"]["value"] == {"published": 1}

    # period_from: старый проект исключается (pid_b удалён из теста).
    summary = _summary(client, mgr["access_token"], period_from="2025-01-01")
    assert summary["metrics"]["projects_total"]["value"] == 1  # pid_a

    # period_to: только старый проект (создан до 2024-12-31).
    summary = _summary(client, mgr["access_token"], period_to="2024-12-31")
    assert summary["metrics"]["projects_total"]["value"] == 1
