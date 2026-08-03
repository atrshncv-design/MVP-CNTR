"""new_core: словарь этапов, заявки на повышение, верифицирующие документы, уведомления, роль

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-02
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0010_new_core.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0010_new_core.sql')"
    )


def downgrade() -> None:
    op.execute("UPDATE public.roles SET slug='ugt_expert', name='Эксперт УГТ' WHERE slug='regulating_organization'")
    op.execute("DROP TABLE IF EXISTS public.notifications")
    op.execute("DROP TABLE IF EXISTS public.verification_documents")
    op.execute("DROP TABLE IF EXISTS public.promotion_requests")
    op.execute("ALTER TABLE public.project_documents DROP COLUMN IF EXISTS stage_requirement_id")
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS preliminary_level")
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS rejection_reason")
    op.execute("DROP TABLE IF EXISTS public.stage_requirements")
