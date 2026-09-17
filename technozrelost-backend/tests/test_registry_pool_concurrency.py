"""REPAIR 2026-09-17: реестр не исчерпывает пул при 50 concurrent.

Диагноз с продакшена: 50 concurrent аутентифицированных
GET /api/v1/projects/registry сыпали
``QueuePool limit of size 10 overflow 20 reached`` — каждый такой запрос
открывал 2 соединения из пула Primary (auth-сессия get_db + read-сессия
get_read_db при отсутствии реплики) и держал оба весь запрос: 50 запросов
требовали 100 при пуле 30. Анонимы шли нормально: их auth-сессия не делала
запросов и соединение не занимала.

Фикс: read-эндпоинты делят одну read-сессию auth+данные (ReadCurrentUser*,
кэш get_read_db) — 1 соединение на запрос; пул 20+35=55 под норматив 50.

Шов — публичная HTTP-граница + счётчик фабрики сессий.
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from tests.support import register_test_user

CONCURRENCY = 50


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _token(client: TestClient) -> str:
    data = register_test_user(
        client,
        email=_email("pool"),
        full_name="Пул Конкурент",
        role_slug="gk_customer",
    )
    return data["access_token"]


def test_pool_budget_covers_50_concurrent() -> None:
    """Пул держит норматив 50 concurrent по 1 соединению + headroom, в лимите БД."""
    from app.core.config import settings

    per_backend = settings.db_pool_size + settings.db_max_overflow
    assert per_backend >= CONCURRENCY, (
        f"пул {per_backend} < норматива {CONCURRENCY} concurrent "
        "(1 соединение на запрос после REPAIR)"
    )
    used = settings.db_app_replicas * per_backend
    assert used + settings.db_connections_reserve < settings.db_max_connections, (
        f"бюджет пулов {used}+{settings.db_connections_reserve} "
        f"не влезает в max_connections={settings.db_max_connections}"
    )


def _count_sessions(client: TestClient, headers: dict[str, str]) -> int:
    """Один GET реестра при подсчёте вызовов фабрики сессий."""
    from app.core import database as db_module

    calls = {"n": 0}
    factory = db_module.SessionLocal

    def counting_factory(*args, **kwargs):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        return factory(*args, **kwargs)

    import pytest

    monkeypatch = pytest.MonkeyPatch()
    try:
        monkeypatch.setattr(db_module, "SessionLocal", counting_factory)
        response = client.get("/api/v1/projects/registry", headers=headers)
        assert response.status_code == 200, response.text
    finally:
        monkeypatch.undo()
    return calls["n"]


def test_registry_auth_uses_single_session(client: TestClient) -> None:
    """Аутентифицированный запрос к реестру открывает 1 сессию, а не 2."""
    token = _token(client)
    ip = f"single-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {token}", "X-Real-IP": ip}
    assert _count_sessions(client, headers) == 1


def test_registry_anonymous_uses_single_session(client: TestClient) -> None:
    """Анонимный запрос к реестру тоже открывает не более 1 сессии."""
    headers = {"X-Real-IP": f"anon-{uuid.uuid4().hex[:8]}"}
    assert _count_sessions(client, headers) <= 1


def test_registry_50_concurrent_authed_no_pool_errors(client: TestClient) -> None:
    """50 потоков аутентифицированного GET /projects/registry — все 200."""
    token = _token(client)

    def one(index: int) -> int:
        response = client.get(
            "/api/v1/projects/registry",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Real-IP": f"conc-{uuid.uuid4().hex[:8]}-{index}",
            },
        )
        return response.status_code

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        statuses = list(pool.map(one, range(CONCURRENCY)))

    assert statuses == [200] * CONCURRENCY, (
        f"пул не держит {CONCURRENCY} concurrent: {sorted(set(statuses))}"
    )
