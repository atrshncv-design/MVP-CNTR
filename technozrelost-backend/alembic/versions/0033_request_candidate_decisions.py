"""tech_requests: решения менеджера по кандидатам matcher

Revision ID: 0033
Revises: 0032
Create Date: 2026-08-11
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0033_request_candidate_decisions.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) "
        "VALUES ('0033_request_candidate_decisions.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.tech_request_candidate_decisions")
