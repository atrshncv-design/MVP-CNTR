"""rag_documents table (pgvector, Hash/B-Tree indexes)

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-21 12:05:00
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0002_rag_documents.sql"))
    op.execute("INSERT INTO public.db_migration_log (filename) VALUES ('0002_rag_documents.sql')")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.rag_documents_embedding_ivfflat")
    op.execute("DROP INDEX IF EXISTS public.rag_documents_ugt_bidx")
    op.execute("DROP INDEX IF EXISTS public.rag_documents_type_created_bidx")
    op.execute("DROP INDEX IF EXISTS public.rag_documents_content_hash_hidx")
    op.execute("DROP TABLE IF EXISTS public.rag_documents")