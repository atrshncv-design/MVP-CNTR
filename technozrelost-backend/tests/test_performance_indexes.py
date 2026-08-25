"""Таск 06 (производительность): горячие пути реестров.

Шов — реальные миграции: conftest поднимает test-БД через
``alembic upgrade head``, поэтому проверка наличия индексов через
pg_indexes проверяет именно миграцию, а не только metadata.
"""

from __future__ import annotations

import os

import psycopg
import pytest

EXPECTED_INDEXES = [
    # Реестр проектов: WHERE is_public ORDER BY current_level DESC, updated_at DESC
    ("ix_projects_public_registry", "projects"),
    # Фильтр реестра по категории
    ("ix_projects_category", "projects"),
    # GET /projects: список проектов пользователя (WHERE user_id)
    ("ix_project_members_user_id", "project_members"),
    # Лента НИОКТР: ORDER BY created_date DESC NULLS LAST, id DESC (+org-фильтры)
    ("ix_nioktr_cards_created_date", "nioktr_cards"),
    ("ix_nioktr_cards_organization_id", "nioktr_cards"),
    # Публичная лента новостей: WHERE status ORDER BY published_at DESC, id DESC
    ("ix_news_posts_status_published", "news_posts"),
]


def _connect():
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname="technozrelost_test",
    )


@pytest.mark.parametrize(("index_name", "table_name"), EXPECTED_INDEXES)
def test_hot_path_indexes_exist(index_name: str, table_name: str) -> None:
    """Каждый индекс из миграции 0027 существует в БД после upgrade head."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' "
            "AND tablename = %s AND indexname = %s",
            (table_name, index_name),
        ).fetchone()
    assert row is not None, f"нет индекса {index_name} на {table_name}"


def test_absorbed_news_status_index_dropped() -> None:
    """Одиночный ix_news_posts_status (0024) поглощён префиксом композита
    (status, ...) и дропнут в 0027 — дубль планировщику не нужен."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' "
            "AND tablename = 'news_posts' "
            "AND indexname = 'ix_news_posts_status'",
        ).fetchone()
    assert row is None, "ix_news_posts_status должен быть дропнут в 0027"
