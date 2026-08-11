"""project_invites_admin: project_admin flag, legal fields, invites

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-05
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0017_project_invites_admin.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0017_project_invites_admin.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.project_invites")
    op.execute("ALTER TABLE public.project_members DROP COLUMN IF EXISTS is_project_admin")
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS legal_owner")
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS rights_holder")
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS contract_number")
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS contract_basis")
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS legal_updated_by")
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS legal_updated_at")
