"""rag_metadata: add template_metadata JSONB to rag_documents

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-21 15:00:00
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0005_rag_metadata.sql"))
    op.execute("INSERT INTO public.db_migration_log (filename) VALUES ('0005_rag_metadata.sql')")


def downgrade() -> None:
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS template_metadata")
