"""Pytest configuration: isolated test database (technozrelost_test).

IMPORTANT: environment must be set BEFORE any `app.*` import — the FastAPI
settings are cached at import time and the engine is built from them.

Миграционный граф: тестовая БД общая для всех worktree репозитория (один
контейнер tz-pg-primary). Если её `alembic_version` указывает на ревизию,
которой нет в цепочке текущей ветки (например `0038` от старой ветки
release-integration), `alembic upgrade head` падает с «Can't locate revision
identified by '0038'». Лечение: пересоздать ТОЛЬКО эфемерную тестовую БД
(DROP ... WITH (FORCE) + CREATE) — conftest создаёт её на лету, прод-БД
`technozrelost` при этом не затрагивается.
"""

from __future__ import annotations

import os

os.environ["POSTGRES_DB"] = "technozrelost_test"
os.environ["POSTGRES_REPLICA_HOST"] = ""  # disable replica checks in tests
os.environ["LLM_API_KEY"] = ""  # tests must not depend on the external LLM API
os.environ.setdefault("APP_ENV", "test")
# Тикет 06: rate limits отключены в тестах по умолчанию (существующие тесты
# не должны упираться в лимиты); rate-limit тесты включают их monkeypatch'ем
# настроек (settings.rate_limit_enabled + малые лимиты).
os.environ["RATE_LIMIT_ENABLED"] = "false"
# Тикет 03: у Settings нет рабочего default JWT_SECRET — тестам задаём явный
# тестовый секрет (>=32 символа) до любых app.* импортов.
os.environ["JWT_SECRET"] = "test-jwt-secret-0123456789abcdef0123456789abcdef"

from collections.abc import Iterator  # noqa: E402
from pathlib import Path  # noqa: E402

import psycopg  # noqa: E402
import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from alembic.util.exc import CommandError  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

TEST_DB = "technozrelost_test"

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _admin_connection() -> psycopg.Connection:
    """Подключение к серверу PostgreSQL (БД `postgres`) для DDL над БД."""
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname="postgres",
        autocommit=True,
    )


def _db_connection(dbname: str) -> psycopg.Connection:
    """Подключение к конкретной БД (autocommit, sync psycopg)."""
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=dbname,
        autocommit=True,
    )


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    return cfg


def _known_revisions(cfg: Config) -> set[str]:
    """Все revision id, достижимые от head текущей ветки (файлы на диске)."""
    from alembic.script import ScriptDirectory

    script = ScriptDirectory.from_config(cfg)
    return {str(s.revision) for s in script.walk_revisions()}


def _test_db_version() -> str | None:
    """Текущая `alembic_version` тестовой БД; None, если таблицы ещё нет."""
    conn = _db_connection(TEST_DB)
    try:
        row = conn.execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'alembic_version'"
        ).fetchone()
        if not row:
            return None
        version = conn.execute(
            "SELECT version_num FROM public.alembic_version"
        ).fetchone()
        return version[0] if version else None
    finally:
        conn.close()


def _recreate_test_db() -> None:
    """Пересоздать эфемерную тестовую БД.

    Допустимо ТОЛЬКО для тестовой БД: conftest создаёт её на лету, а её
    данные по определению не являются пользовательскими. Прод-БД
    `technozrelost` здесь не фигурирует и не затрагивается.
    """
    conn = _admin_connection()
    try:
        conn.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)')
        conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    finally:
        conn.close()


def _ensure_test_db_schema(cfg: Config) -> None:
    """Гарантировать, что тестовая БД стоит на ревизии, достижимой от head.

    - БД отсутствует → создать.
    - `alembic_version` содержит ревизию, которой нет в цепочке текущей
      ветки (stale-цепочка другого worktree, например `0038`) → пересоздать
      тестовую БД (иначе upgrade head падает с CommandError).
    """
    conn = _admin_connection()
    try:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{TEST_DB}"')
            return
    finally:
        conn.close()

    version = _test_db_version()
    if version is not None and version not in _known_revisions(cfg):
        _recreate_test_db()


def _run_migrations(cfg: Config) -> None:
    from alembic import command

    command.upgrade(cfg, "head")


@pytest.fixture(scope="session", autouse=True)
def _test_database() -> None:
    """Ensure the test DB exists and is migrated once per session."""
    cfg = _alembic_config()
    _ensure_test_db_schema(cfg)
    try:
        _run_migrations(cfg)
    except CommandError:
        # Страховка: если upgrade упал из-за недостижимой ревизии в
        # alembic_version (например «Can't locate revision identified by
        # '0038'»), пересоздаём эфемерную тестовую БД и повторяем один раз.
        _recreate_test_db()
        _run_migrations(cfg)


@pytest.fixture()
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _clean_tables() -> Iterator[None]:
    """Truncate mutable data after every test so tests are independent.

    Uses sync psycopg deliberately: the async engine pool is bound to the
    TestClient's event loop, and asyncio.run() would hit "attached to a
    different loop" errors.
    """
    yield
    conn = _db_connection(TEST_DB)
    try:
        conn.execute(
            "TRUNCATE TABLE public.assessment_answers, public.project_assessments, "
            "public.assessment_checkpoints, public.assessment_templates, "
            "public.audit_trail, public.project_documents, "
            "public.control_points, public.questionnaire_results, "
            "public.project_members, public.projects, public.rag_documents, "
            "public.technologies, public.organizations, public.nioktr_cards, "
            "public.refresh_tokens, public.user_roles, public.users, "
            "public.user_profiles, public.user_organizations, public.organization_members, "
            "public.project_invites, public.promotion_requests, "
            "public.promotion_request_documents, notification_outbox, "
            "public.news_post_media, public.news_post_tags, public.news_posts, "
            "public.news_tags, public.news_categories, "
            "public.achievements, public.user_achievements, public.project_achievements "
            "RESTART IDENTITY CASCADE"
        )
    finally:
        conn.close()
