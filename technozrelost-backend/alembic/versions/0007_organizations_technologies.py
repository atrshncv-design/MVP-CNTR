"""organizations_technologies: реестры организаций и технологий (НИОКТР)

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-02
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0007_organizations_technologies.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0007_organizations_technologies.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.technologies")
    op.execute("DROP TABLE IF EXISTS public.organizations")
