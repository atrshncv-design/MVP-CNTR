"""performance_indexes: индексы горячих путей реестров (таск 06)

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-25

Реестр проектов (partial по is_public), участник→проекты, сортировка и
организации НИОКТР, публичная лента новостей. Миграция обратима:
downgrade удаляет все шесть индексов и восстанавливает поглощённый
композитом ix_news_posts_status из 0024.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"

_INDEXES = (
    ("ix_projects_public_registry", "projects"),
    ("ix_projects_category", "projects"),
    ("ix_project_members_user_id", "project_members"),
    ("ix_nioktr_cards_created_date", "nioktr_cards"),
    ("ix_nioktr_cards_organization_id", "nioktr_cards"),
    ("ix_news_posts_status_published", "news_posts"),
)

# Исходное определение ix_news_posts_status из 0024_news.sql: одиночный
# btree поглощён левым префиксом (status) композита и в upgrade дропается.
# Без префикса у имени: PG не принимает schema-квалификацию с IF NOT EXISTS.
_ABSORBED_INDEX_DDL = (
    "CREATE INDEX IF NOT EXISTS ix_news_posts_status "
    "ON public.news_posts (status)"
)


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0027_performance_indexes.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0027_performance_indexes.sql')"
    )


def downgrade() -> None:
    for index_name, table_name in _INDEXES:
        op.execute(f"DROP INDEX IF EXISTS public.{index_name}")
    op.execute(_ABSORBED_INDEX_DDL)
