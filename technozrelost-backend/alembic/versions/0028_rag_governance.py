"""rag_governance: редакционный workflow базы знаний (draft/published/retired)

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-10

"""
from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0028_rag_governance.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0028_rag_governance.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.rag_retired_log")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS status")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS version")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS source_type")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS is_ai_reviewed")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS published_by")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS published_at")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS reviewed_by")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS reviewed_at")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS retired_at")
