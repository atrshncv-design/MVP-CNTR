"""fix_gost_mojibake: correct mojibake GOST titles/source_uri

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-04
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0012_fix_gost_mojibake.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0012_fix_gost_mojibake.sql')"
    )


def downgrade() -> None:
    # Данные необратимо перезаписаны; downgrade — no-op.
    pass
