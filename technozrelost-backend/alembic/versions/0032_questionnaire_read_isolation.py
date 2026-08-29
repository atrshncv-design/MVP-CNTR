"""questionnaire read isolation: user_id NOT NULL (TICKET-07, M-02)

Revision ID: 0032
Revises: 0031
Create Date: 2026-08-29

M-02: после 0030 per-user запись per-user, но GET /projects/{id}
отдавал все строки проекта любому участнику (read leak). 0032
закрывает схему: повторный backfill NULL → created_by, затем
SET NOT NULL + индекс для изолированных выборок. Чтение изолируется
в projects.py:508 (member where user_id == current, staff — все).
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
    op.execute(_sql("0032_questionnaire_read_isolation.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) "
        "VALUES ('0032_questionnaire_read_isolation.sql')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE public.questionnaire_results ALTER COLUMN user_id DROP NOT NULL")
    # M4 TICKET-04 (SPEC-02 L-03): downgrade теперь обратим — чистим индексы 0032
    op.execute("DROP INDEX IF EXISTS public.ix_questionnaire_results_user_id")
    op.execute("DROP INDEX IF EXISTS public.ix_questionnaire_results_project_level_user")
