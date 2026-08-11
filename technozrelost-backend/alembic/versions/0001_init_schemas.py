"""init schemas + pgvector

Revision ID: 0001
Revises:
Create Date: 2026-07-21 12:00:00
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0001_init_schemas.sql"))
    op.execute("INSERT INTO public.db_migration_log (filename) VALUES ('0001_init_schemas.sql')")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.db_migration_log_applied_at_bidx")
    op.execute("DROP INDEX IF EXISTS public.db_migration_log_filename_hidx")
    op.execute("DROP TABLE IF EXISTS public.db_migration_log")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
    op.execute("DROP SCHEMA IF EXISTS test")
    # public не удаляем — системная схема PostgreSQL.