"""project_stages, stage_tasks, stage-привязки control_points/project_documents

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-10
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0024_project_operations.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0024_project_operations.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.stage_tasks")
    op.execute("DROP TABLE IF EXISTS public.project_stages")
    op.execute("ALTER TABLE public.control_points DROP COLUMN IF EXISTS stage_id")
    op.execute("ALTER TABLE public.control_points DROP COLUMN IF EXISTS due_date")
    op.execute("ALTER TABLE public.control_points DROP COLUMN IF EXISTS weight")
    op.execute("ALTER TABLE public.project_documents DROP COLUMN IF EXISTS stage_id")
