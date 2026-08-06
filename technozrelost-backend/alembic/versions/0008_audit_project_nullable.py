"""audit_project_nullable: аудит действий вне проекта

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-02
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0008_audit_project_nullable.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0008_audit_project_nullable.sql')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE public.audit_trail ALTER COLUMN project_id SET NOT NULL")
