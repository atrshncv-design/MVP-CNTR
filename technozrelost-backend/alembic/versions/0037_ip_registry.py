"""ip_assets / ip_authors / ip_documents: реестр РИД (тикет 03 operations-modules)

Revision ID: 0033
Revises: 0032
Create Date: 2026-08-11

Примечание: глобальный номер 0033 выдан оркестратором; локальная цепочка
ветки codex/operations-modules-complete остаётся линейной — down_revision =
фактический head ветки (0032_expert_workflow).
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0033_ip_registry.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0033_ip_registry.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.ip_documents")
    op.execute("DROP TABLE IF EXISTS public.ip_authors")
    op.execute("DROP TABLE IF EXISTS public.ip_assets")
