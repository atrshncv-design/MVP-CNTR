"""expert_assignments / expert_conclusions: реестр экспертов и заключения

Revision ID: 0032
Revises: 0024
Create Date: 2026-08-11

Примечание: оркестратор выдал глобальный номер 0032; локальная цепочка
ветки codex/operations-modules-complete остаётся линейной — down_revision =
фактический head ветки (0024_project_operations), а не «0031» из ТЗ
(миграции 0025–0031 принадлежат параллельным worktree и в эту ветку не
входят). Отклонение зафиксировано в verification-report (раздел «Тикет 02»).
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0032_expert_workflow.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0032_expert_workflow.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.expert_conclusions")
    op.execute("DROP TABLE IF EXISTS public.expert_assignments")
