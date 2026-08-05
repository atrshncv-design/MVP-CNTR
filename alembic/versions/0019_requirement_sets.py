"""requirement_sets: request document snapshot, template version

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-05
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0019_requirement_sets.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0019_requirement_sets.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.promotion_request_documents")
    op.execute("ALTER TABLE public.stage_requirements DROP COLUMN IF EXISTS template_version")
