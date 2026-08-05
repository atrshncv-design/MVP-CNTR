"""profiles_organizations: user profiles, user organizations, membership

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-05
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0016_profiles_organizations.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0016_profiles_organizations.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.organization_members")
    op.execute("DROP TABLE IF EXISTS public.user_organizations")
    op.execute("DROP TABLE IF EXISTS public.user_profiles")
