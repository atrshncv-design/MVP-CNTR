"""questionnaire_per_user: per-user изоляция анкеты (N-16)

Revision ID: 0030
Revises: 0029
Create Date: 2026-08-29

N-16: save_questionnaire перезаписывал общие записи; вводим user_id
FK → users(id) nullable для обратной совместимости, бэкфилим
старые строки created_by проекта, меняем UNIQUE (project_id, level_id)
на (project_id, level_id, user_id). Индексы по конвенции: B-Tree по
умолчанию для точечного поиска, Hash не нужен (составной ключ).
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
    op.execute(_sql("0030_questionnaire_per_user.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0030_questionnaire_per_user.sql')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE public.questionnaire_results DROP CONSTRAINT IF EXISTS uq_project_level_user")
    op.execute("DROP INDEX IF EXISTS public.ix_questionnaire_results_project_level_user")
    op.execute("DROP INDEX IF EXISTS public.ix_questionnaire_results_user_id")
    op.execute("ALTER TABLE public.questionnaire_results DROP COLUMN IF EXISTS user_id")
    op.execute(
        "ALTER TABLE public.questionnaire_results ADD CONSTRAINT uq_project_level UNIQUE (project_id, level_id)"
    )
