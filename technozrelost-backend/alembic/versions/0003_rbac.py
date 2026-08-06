"""rbac: roles, users, user_roles, permissions, role_permissions

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-21 13:00:00
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0003_rbac.sql"))
    op.execute("INSERT INTO public.db_migration_log (filename) VALUES ('0003_rbac.sql')")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.user_roles")
    op.execute("DROP TABLE IF EXISTS public.users")
    op.execute("DROP TABLE IF EXISTS public.role_permissions")
    op.execute("DROP TABLE IF EXISTS public.permissions")
    op.execute("DROP TABLE IF EXISTS public.roles")