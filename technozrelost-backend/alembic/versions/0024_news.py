"""news: news_posts / news_categories / news_tags / news_post_tags / news_post_media

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-25

Перенос новостного раздела со старой линии (там — миграция 0027).

Таблицы (спека §3.2):
- news_categories — справочник категорий (seed в SQL: События/Конкурсы/
  Проекты/Обучение/Партнёрства), slug UNIQUE;
- news_tags — мягкие теги (создаются при первом использовании);
- news_posts — новости: status draft|scheduled|published, author_id (Hash),
  published_at B-Tree (сортировка ленты), source manual|auto|api;
- news_post_tags — связь многие-ко-многим;
- news_post_media — медиа (обложка/вложение/галерея), storage_key в
  файловом хранилище.

Миграция обратима: downgrade удаляет только таблицы модуля.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0024_news.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0024_news.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.news_post_media")
    op.execute("DROP TABLE IF EXISTS public.news_post_tags")
    op.execute("DROP TABLE IF EXISTS public.news_posts")
    op.execute("DROP TABLE IF EXISTS public.news_tags")
    op.execute("DROP TABLE IF EXISTS public.news_categories")
