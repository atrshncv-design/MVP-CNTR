"""file_storage: document file metadata (MinIO + ClamAV)

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-05
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0018_file_storage.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0018_file_storage.sql')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE public.project_documents DROP COLUMN IF EXISTS storage_key")
    op.execute("ALTER TABLE public.project_documents DROP COLUMN IF EXISTS file_name")
    op.execute("ALTER TABLE public.project_documents DROP COLUMN IF EXISTS file_size")
    op.execute("ALTER TABLE public.project_documents DROP COLUMN IF EXISTS mime_type")
    op.execute("ALTER TABLE public.project_documents DROP COLUMN IF EXISTS sha256")
    op.execute("ALTER TABLE public.project_documents DROP COLUMN IF EXISTS scan_status")
    op.execute("ALTER TABLE public.project_documents DROP COLUMN IF EXISTS scan_result")
