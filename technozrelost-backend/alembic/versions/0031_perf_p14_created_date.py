"""perf p14: created_date VARCHAR(32) -> DATE

Revision ID: 0031
Revises: 0030
Create Date: 2026-08-29

P-14: created_date String(32) → Date (доменная миграция).
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0031_perf_p14_created_date.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0031_perf_p14_created_date.sql')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE public.nioktr_cards ALTER COLUMN created_date TYPE VARCHAR(32) USING created_date::text")
    op.execute("DROP INDEX IF EXISTS public.ix_nioktr_cards_created_date")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_nioktr_cards_created_date "
        "ON public.nioktr_cards (created_date DESC NULLS LAST, id DESC)"
    )
