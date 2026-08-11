"""mfa: MFA для служебных ролей (тикет 02 identity-organizations)

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-10
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0025_mfa.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0025_mfa.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.mfa_challenges")
    op.execute("DROP TABLE IF EXISTS public.mfa_recovery_codes")
    op.execute("DROP TABLE IF EXISTS public.mfa_credentials")
