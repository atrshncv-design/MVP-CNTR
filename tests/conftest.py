"""Pytest configuration: isolated test database (technozrelost_test).

IMPORTANT: environment must be set BEFORE any `app.*` import — the FastAPI
settings are cached at import time and the engine is built from them.
"""

from __future__ import annotations

import os

os.environ["POSTGRES_DB"] = "technozrelost_test"
os.environ["POSTGRES_REPLICA_HOST"] = ""  # disable replica checks in tests
os.environ["LLM_API_KEY"] = ""  # tests must not depend on the external LLM API
os.environ.setdefault("APP_ENV", "test")

from collections.abc import Iterator  # noqa: E402
from pathlib import Path  # noqa: E402

import psycopg  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

TEST_DB = "technozrelost_test"

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _create_test_db() -> None:
    """Create the test database if it does not exist (idempotent)."""
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname="postgres",
        autocommit=True,
    )
    try:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    finally:
        conn.close()


def _run_migrations() -> None:
    from alembic.config import Config

    from alembic import command

    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session", autouse=True)
def _test_database() -> None:
    """Ensure the test DB exists and is migrated once per session."""
    _create_test_db()
    _run_migrations()


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
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=TEST_DB,
        autocommit=True,
    )
    try:
        conn.execute(
            "TRUNCATE TABLE public.assessment_answers, public.project_assessments, "
            "public.assessment_checkpoints, public.assessment_templates, "
            "public.audit_trail, public.project_documents, "
            "public.control_points, public.questionnaire_results, "
            "public.project_members, public.projects, public.rag_documents, "
            "public.technologies, public.organizations, public.nioktr_cards, "
            "public.refresh_tokens, public.user_roles, public.users, "
            "public.user_profiles, public.user_organizations, public.organization_members " 
            "RESTART IDENTITY CASCADE"
        )
    finally:
        conn.close()
