"""rag_cost_gate: серверные rate limits и cost gate публичного /rag/chat (тикет 04 ai-rag)

Revision ID: 0030
Revises: 0029
Create Date: 2026-08-10

"""
from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0030_rag_cost_gate.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0030_rag_cost_gate.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.rag_rate_limit_state")
    op.execute("DROP TABLE IF EXISTS public.rag_cost_state")
