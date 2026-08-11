"""tech_requests: офферы кандидатам, раскрытия, связанные проекты

Revision ID: 0034
Revises: 0033
Create Date: 2026-08-11
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0034_offer_disclosure_project.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) "
        "VALUES ('0034_offer_disclosure_project.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.tech_request_projects")
    op.execute("DROP TABLE IF EXISTS public.tech_request_disclosures")
    op.execute("DROP TABLE IF EXISTS public.tech_request_offers")
