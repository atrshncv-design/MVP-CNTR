"""organization_card: карточка организации по ИНН (тикет 03 identity-organizations)

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-10
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0026_organization_card.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0026_organization_card.sql')"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.uq_user_organizations_inn")
    op.execute("DROP INDEX IF EXISTS public.idx_user_organizations_inn_hidx")
    op.execute("ALTER TABLE public.user_organizations DROP COLUMN IF EXISTS inn")
    op.execute("ALTER TABLE public.user_organizations DROP COLUMN IF EXISTS kpp")
    op.execute("ALTER TABLE public.user_organizations DROP COLUMN IF EXISTS contacts")
    op.execute(
        "ALTER TABLE public.user_organizations DROP COLUMN IF EXISTS verification_decision"
    )
