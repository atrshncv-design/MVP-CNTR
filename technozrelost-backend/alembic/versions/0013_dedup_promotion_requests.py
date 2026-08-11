"""dedup_promotion_requests: partial unique index on active requests

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-04
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0013_dedup_promotion_requests.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0013_dedup_promotion_requests.sql')"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.uq_promotion_requests_active_stage")
