"""nioktr_source: source and import date for external records

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-05
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0022_nioktr_source.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0022_nioktr_source.sql')"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE public.nioktr_cards "
        "DROP COLUMN IF EXISTS source, "
        "DROP COLUMN IF EXISTS imported_at"
    )
