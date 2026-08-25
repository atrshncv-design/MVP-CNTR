"""achievements: каталог достижений (66 медалей)

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-25

Перенос со старой линии (там — миграция 0028 + отдельный seed-скрипт).

Таблица (спека §4.2):
- achievements — каталог медалей: slug UNIQUE (= icon_key), title/description,
  group (ugt|documents|project|quality|sector|role|member|organization|secret),
  rarity (common|epic|legendary), sector_slug, threshold, ugt_level, secret,
  sort_order, icon_key.

Каталог наполняется здесь же: идемпотентный seed 66 медалей
(INSERT ... ON CONFLICT (slug) DO UPDATE). Повторный прогон миграции и
повторное применение не плодят дублей; тот же состав лежит в
app/db/seed_achievements.py для идемпотентного пересева.
Миграция обратима: downgrade удаляет таблицу.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0025_achievements.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0025_achievements.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.achievements")
