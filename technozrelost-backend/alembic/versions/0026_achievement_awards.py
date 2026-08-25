"""achievement_awards: user_achievements / project_achievements

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-25

Перенос со старой линии (там — миграция 0029).

Таблицы (спека §4.2):
- user_achievements — персональные медали: user_id/achievement_id (Hash),
  project_id, event_ref (ключ события для отзыва/дедупликации), times
  (для ступеней = порог), awarded_at; UNIQUE (user_id, achievement_id,
  event_ref).
- project_achievements — командные медали проекта: UNIQUE (project_id,
  achievement_id).

Миграция обратима: downgrade удаляет обе таблицы.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0026_achievement_awards.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0026_achievement_awards.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.project_achievements")
    op.execute("DROP TABLE IF EXISTS public.user_achievements")
