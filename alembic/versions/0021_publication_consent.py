"""publication_consent: project publish consent

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-05
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0021_publication_consent.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0021_publication_consent.sql')"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE public.projects "
        "DROP COLUMN IF EXISTS is_public, "
        "DROP COLUMN IF EXISTS show_preliminary, "
        "DROP COLUMN IF EXISTS published_at"
    )
