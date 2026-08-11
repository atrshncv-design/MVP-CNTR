"""join_tokens: join-механика проекта (токен + статусы участников)

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-02
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0006_join_tokens.sql"))
    op.execute("INSERT INTO public.db_migration_log (filename) VALUES ('0006_join_tokens.sql')")


def downgrade() -> None:
    op.execute("ALTER TABLE public.project_members DROP COLUMN IF EXISTS is_priority")
    op.execute("ALTER TABLE public.project_members DROP COLUMN IF EXISTS invited_by")
    op.execute("ALTER TABLE public.project_members DROP COLUMN IF EXISTS status")
    op.execute("DROP INDEX IF EXISTS public.uq_projects_join_token")
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS join_token")
