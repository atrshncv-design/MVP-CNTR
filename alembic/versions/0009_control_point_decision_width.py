"""control_point_decision_width: расширение поля решения КТ

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-02
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0009_control_point_decision_width.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0009_control_point_decision_width.sql')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE public.control_points ALTER COLUMN decision TYPE VARCHAR(16)")
