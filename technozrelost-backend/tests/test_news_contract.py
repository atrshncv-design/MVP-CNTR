"""Контракто-тесты форм ответов под фронтовые типы (deploy-readiness).

Эталон — technozrelost-frontend/src/lib/news-types.ts и раздел news в
api-client.ts: бэкенд подгоняется под формы ответов, фронт не меняется.
Проверяются точные наборы ключей (лишние/недостающие поля = расхождение
контракта) и пути публичных эндпоинтов.
"""

from __future__ import annotations

import os
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from tests.support import register_test_user

CARD_KEYS = {
    "id",
    "title",
    "excerpt",
    "cover_key",
    "category",
    "tags",
    "published_at",
    "created_at",
}
DETAIL_EXTRA_KEYS = {
    "content",
    "author_id",
    "author_name",
    "status",
    "scheduled_at",
    "source",
    "created_automatically",
    "media",
    "updated_at",
}
CATEGORY_KEYS = {"id", "slug", "name"}
TAG_KEYS = {"id", "slug", "name"}
MEDIA_KEYS = {
    "id",
    "storage_key",
    "file_name",
    "mime_type",
    "kind",
    "sort_order",
    "created_at",
}
FEED_KEYS = {"items", "total", "page", "per_page"}
ACHIEVEMENT_KEYS = {
    "id",
    "slug",
    "title",
    "description",
    "group",
    "rarity",
    "sector_slug",
    "threshold",
    "ugt_level",
    "secret",
    "sort_order",
    "icon_key",
}


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def seeded_catalog() -> None:
    """Каталог 66 медалей (conftest truncate'ит achievements после теста)."""
    from app.db.seed_achievements import _CATALOG

    conn = _seed_conn()
    try:
        for sort_order, item in enumerate(_CATALOG, start=1):
            (
                slug,
                title,
                group_,
                rarity,
                description,
                sector_slug,
                threshold,
                ugt_level,
                secret,
            ) = item
            conn.execute(
                """
                INSERT INTO public.achievements
                    (slug, title, description, "group", rarity, sector_slug,
                     threshold, ugt_level, secret, sort_order, icon_key)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (slug) DO UPDATE SET icon_key = EXCLUDED.icon_key
                """,
                (
                    slug,
                    title,
                    description,
                    group_,
                    rarity,
                    sector_slug,
                    threshold,
                    ugt_level,
                    secret,
                    sort_order,
                    slug,
                ),
            )
    finally:
        conn.close()


def _seed_conn() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


def _register(client: TestClient, role: str = "cntr_admin") -> str:
    data = register_test_user(
        client,
        email=f"contract-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Контракт",
        role_slug=role,
    )
    return data["access_token"]


def _seed_category(slug: str) -> int:
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public.news_categories (slug, name, sort_order) "
                "VALUES (%s, %s, 0) ON CONFLICT (slug) DO NOTHING",
                (slug, "Контрактная категория"),
            )
            cur.execute(
                "SELECT id FROM public.news_categories WHERE slug = %s", (slug,)
            )
            row = cur.fetchone()
        conn.commit()
    finally:
        conn.close()
    assert row is not None
    return row[0]


def test_feed_shape_matches_news_types(client: TestClient) -> None:
    """GET /news → NewsFeed{items[NewsCard],total,page,per_page} без лишних полей."""
    token = _register(client)
    created = client.post(
        "/api/v1/news",
        headers=_auth(token),
        json={
            "title": "Контракт ленты",
            "content": "<p>Текст</p>",
            "tags": ["контракт"],
            "status": "published",
        },
    )
    assert created.status_code == 201, created.text

    response = client.get("/api/v1/news")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == FEED_KEYS, set(body)
    assert isinstance(body["total"], int)
    assert isinstance(body["page"], int)
    assert isinstance(body["per_page"], int)

    card = next(i for i in body["items"] if i["title"] == "Контракт ленты")
    assert set(card) == CARD_KEYS, set(card)
    # NewsCategory | null; NewsTag[] с ключами {id, slug, name}
    assert card["category"] is None
    for tag in card["tags"]:
        assert set(tag) == TAG_KEYS
    # excerpt: string | null — строка без HTML-тегов
    assert card["excerpt"] is None or isinstance(card["excerpt"], str)


def test_detail_shape_matches_news_types(client: TestClient) -> None:
    """GET /news/{id} → NewsDetail = NewsCard + контентные поля + media[]."""
    token = _register(client)
    cat_id = _seed_category("contract-cat")
    created = client.post(
        "/api/v1/news",
        headers=_auth(token),
        json={
            "title": "Контракт карточки",
            "content": "<p>Содержимое</p>",
            "category_id": cat_id,
            "tags": [],
            "status": "draft",
        },
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    detail = client.get(f"/api/v1/news/{post_id}", headers=_auth(token))
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert set(body) == CARD_KEYS | DETAIL_EXTRA_KEYS, set(body)
    assert set(body["category"]) == CATEGORY_KEYS
    assert body["media"] == []
    assert body["source"] == "manual"
    assert body["created_automatically"] is False

    # media-элемент: NewsMedia из news-types.ts (multipart → JSON-форма).
    upload = client.post(
        f"/api/v1/news/{post_id}/media",
        headers=_auth(token),
        files={"file": ("pic.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 32, "image/png")},
        data={"kind": "inline"},
    )
    assert upload.status_code == 201, upload.text
    media = upload.json()
    assert set(media) == MEDIA_KEYS, set(media)
    refreshed = client.get(f"/api/v1/news/{post_id}", headers=_auth(token))
    assert len(refreshed.json()["media"]) == 1


def test_categories_shape_matches_news_types(client: TestClient) -> None:
    """GET /news/categories → NewsCategory[{id,slug,name}] (публичный)."""
    _seed_category("contract-public")
    response = client.get("/api/v1/news/categories")
    assert response.status_code == 200
    items = response.json()
    assert any(c["slug"] == "contract-public" for c in items)
    for item in items:
        assert set(item) == CATEGORY_KEYS, set(item)


def test_achievements_catalog_shape(client: TestClient, seeded_catalog) -> None:
    """GET /achievements/catalog → [{...66 медалей}] с точным набором полей."""
    response = client.get("/api/v1/achievements/catalog")
    assert response.status_code == 200, response.text
    items = response.json()
    assert len(items) == 66, f"каталог должен содержать 66 медалей, получено {len(items)}"
    for item in items:
        assert set(item) == ACHIEVEMENT_KEYS, set(item)
    slugs = [a["slug"] for a in items]
    assert len(slugs) == len(set(slugs)), "slug каталога уникальны"
    assert all(a["icon_key"] == a["slug"] for a in items), "slug = icon_key"


def test_mine_shape_matches_frontend_interface(client: TestClient) -> None:
    """GET /achievements/mine → UserAchievementOut[] (achievements-showcase.tsx)."""
    token = _register(client)
    response = client.get("/api/v1/achievements/mine", headers=_auth(token))
    assert response.status_code == 200, response.text
    assert response.json() == []
