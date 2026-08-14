"""achievement_awards: таблицы наградчиков достижений

Revision ID: 0029
Revises: 0028
Create Date: 2026-08-14

Тикет 02 (news-achievements): механика наградчиков достижений.

Таблицы (спека §4.2):
- user_achievements — персональные медали: user_id/achievement_id
  (Hash-индексы), project_id (NULL для непроектных), event_ref (ключ
  события для отзыва/дедупликации), times (счётчик повторений, для
  ступеней = порог), awarded_at; UNIQUE B-Tree (user_id, achievement_id,
  event_ref).
- project_achievements — командные медали проекта: project_id
  (Hash-индекс), achievement_id, awarded_at; UNIQUE (project_id,
  achievement_id).

Миграция обратима: downgrade удаляет обе таблицы.
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
    op.execute(_sql("0029_achievement_awards.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0029_achievement_awards.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.project_achievements")
    op.execute("DROP TABLE IF EXISTS public.user_achievements")
