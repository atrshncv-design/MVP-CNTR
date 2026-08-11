"""rag_guardrails: серверный topic gate и off-topic блокировка (тикет 03 ai-rag)

Revision ID: 0029
Revises: 0028
Create Date: 2026-08-10

"""
from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0029_rag_guardrails.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0029_rag_guardrails.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.rag_abuse_state")
