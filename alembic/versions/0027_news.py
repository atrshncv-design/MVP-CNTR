"""news: news_posts / news_categories / news_tags / news_post_tags / news_post_media

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-14

Тикет 05 (news-achievements): новостной раздел.

Таблицы (спека §3.2):
- news_categories — справочник категорий (seed: События/Конкурсы/Проекты/
  Обучение/Партнёрства), slug UNIQUE B-Tree;
- news_tags — мягкие теги (создаются при первом использовании),
  slug UNIQUE B-Tree;
- news_posts — сами новости: status draft|scheduled|published (B-Tree),
  author_id (Hash — точный поиск), category_id (B-Tree), published_at
  (B-Tree — сортировка ленты), source manual|auto|api,
  created_automatically;
- news_post_tags — связь многие-ко-многим, PK (post_id, tag_id);
- news_post_media — медиа (обложка/вложение/галерея): storage_key в
  файловом хранилище (MinIO, сигнатурный MIME, лимит 25 МБ), kind
  inline|attachment|gallery, B-Tree по post_id.

Миграция обратима: downgrade удаляет только таблицы этого тикета.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0027_news.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0027_news.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.news_post_media")
    op.execute("DROP TABLE IF EXISTS public.news_post_tags")
    op.execute("DROP TABLE IF EXISTS public.news_posts")
    op.execute("DROP TABLE IF EXISTS public.news_tags")
    op.execute("DROP TABLE IF EXISTS public.news_categories")
