"""support_programs / checklists / progress: каталог мер поддержки (тикет 04 operations-modules)

Revision ID: 0034
Revises: 0033
Create Date: 2026-08-11

Примечание: глобальный номер 0034 выдан оркестратором; локальная цепочка
ветки codex/operations-modules-complete остаётся линейной — down_revision =
фактический head ветки (0033_ip_registry).
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0034_grant_catalog.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0034_grant_catalog.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.support_program_checklist_progress")
    op.execute("DROP TABLE IF EXISTS public.support_program_checklists")
    op.execute("DROP TABLE IF EXISTS public.support_programs")
