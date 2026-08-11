"""tech_requests: конфиденциальность и модерация запроса

Revision ID: 0032
Revises: 0031
Create Date: 2026-08-11
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0032_request_visibility.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0032_request_visibility.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.tech_request_moderation_log")
    op.execute("ALTER TABLE public.tech_requests DROP COLUMN IF EXISTS moderation_reason")
    op.execute("ALTER TABLE public.tech_requests DROP COLUMN IF EXISTS moderated_at")
    op.execute("ALTER TABLE public.tech_requests DROP COLUMN IF EXISTS moderated_by")
    op.execute("ALTER TABLE public.tech_requests DROP COLUMN IF EXISTS moderation_status")
    op.execute("ALTER TABLE public.tech_requests DROP COLUMN IF EXISTS visibility")
