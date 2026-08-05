"""refresh_tokens: revocable refresh tokens (rotation)

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-04
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0015_refresh_tokens.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0015_refresh_tokens.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.refresh_tokens")
