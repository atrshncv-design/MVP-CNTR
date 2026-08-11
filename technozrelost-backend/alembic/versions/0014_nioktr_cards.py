"""nioktr_cards: registry of NIOKTR cards

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-04
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0014_nioktr_cards.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0014_nioktr_cards.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.nioktr_cards")
