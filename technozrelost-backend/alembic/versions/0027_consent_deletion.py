"""consent_deletion: версионируемые согласия и обезличивание (тикет 04 identity-organizations)

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-10
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0027_consent_deletion.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0027_consent_deletion.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.deletion_requests")
    op.execute("DROP TABLE IF EXISTS public.consent_acceptances")
    op.execute("DROP TABLE IF EXISTS public.consent_versions")
