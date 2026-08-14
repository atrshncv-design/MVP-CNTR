"""achievements: каталог достижений (66 медалей)

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-14

Тикет 01 (news-achievements): каталог достижений.

Таблица (спека §4.2):
- achievements — каталог медалей: slug UNIQUE B-Tree (= icon_key),
  title/description, group (ugt|documents|project|quality|sector|role|
  member|organization|secret, B-Tree), rarity (common|epic|legendary,
  B-Tree), sector_slug (только отраслевые), threshold (ступени),
  ugt_level (1–9), secret (скрыта до получения), sort_order, icon_key,
  created_at/updated_at.

Наполнение — идемпотентный seed (app/db/seed_achievements.py), миграция
создаёт только схему. Миграция обратима: downgrade удаляет таблицу.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0028_achievements.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0028_achievements.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.achievements")
