"""Новостной раздел: публичная лента, права, статусы, media (тикет 05).

Паттерны: register_test_user (tests/support.py), прямой psycopg для
seed-категорий (conftest TRUNCATE вычищает категории после каждого теста —
seed лежит только в миграции 0027).
"""

from __future__ import annotations

import io
import os
import uuid
from datetime import UTC, datetime, timedelta

import psycopg
from fastapi.testclient import TestClient

from tests.support import register_test_user

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 96  # сигнатура PNG


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(
    client: TestClient, role: str = "gk_customer"
) -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("news"), full_name="Новостник", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _seed_category(slug: str = "testcat") -> int:
    """Категория для тестов (conftest TRUNCATE стирает seed миграции)."""
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
                (slug, "Тестовая категория"),
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


def _create_news(
    client: TestClient,
    token: str,
    *,
    title: str = "Новость о центре",
    content: str = "<p>Содержимое новости</p>",
    tags: list[str] | None = None,
    **overrides,
):
    payload = {
        "title": title,
        "content": content,
        "tags": tags if tags is not None else ["центр"],
        "status": "draft",
        **overrides,
    }
    return client.post(
        "/api/v1/news", headers=_auth(token), json=payload
    )


# ── Публичная лента и видимость ────────────────────────────────────────────


def test_feed_is_public_and_shows_only_published(client: TestClient) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    draft = _create_news(client, admin_token, title="Черновик")
    assert draft.status_code == 201, draft.text
    published = _create_news(
        client, admin_token, title="Опубликовано", status="published"
    )
    assert published.status_code == 201, published.text

    feed = client.get("/api/v1/news")
    assert feed.status_code == 200, feed.text
    body = feed.json()
    titles = [item["title"] for item in body["items"]]
    assert "Опубликовано" in titles
    assert "Черновик" not in titles
    assert body["total"] == 1


def test_detail_draft_hidden_from_anon_visible_to_author(
    client: TestClient,
) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    created = _create_news(client, admin_token, title="Только автору")
    post_id = created.json()["id"]

    anon = client.get(f"/api/v1/news/{post_id}")
    assert anon.status_code == 404, anon.text

    author = client.get(
        f"/api/v1/news/{post_id}", headers=_auth(admin_token)
    )
    assert author.status_code == 200, author.text
    assert author.json()["title"] == "Только автору"
    assert author.json()["status"] == "draft"


def test_categories_endpoint_public(client: TestClient) -> None:
    _seed_category("cat-public")
    response = client.get("/api/v1/news/categories")
    assert response.status_code == 200, response.text
    slugs = [c["slug"] for c in response.json()]
    assert "cat-public" in slugs


# ── Права ───────────────────────────────────────────────────────────────────


def test_create_requires_staff(client: TestClient) -> None:
    token, _ = _register(client, "gk_customer")
    response = _create_news(client, token)
    assert response.status_code == 403, response.text


def test_manager_cannot_manage_foreign_news(client: TestClient) -> None:
    author_token, author_id = _register(client, "cntr_manager")
    created = _create_news(client, author_token, title="Чужая для другого")
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    other_token, _ = _register(client, "cntr_manager")
    patch = client.patch(
        f"/api/v1/news/{post_id}",
        headers=_auth(other_token),
        json={"title": "Взлом"},
    )
    assert patch.status_code == 403, patch.text

    delete = client.delete(
        f"/api/v1/news/{post_id}", headers=_auth(other_token)
    )
    assert delete.status_code == 403, delete.text

    # Автор управляет своей.
    own = client.patch(
        f"/api/v1/news/{post_id}",
        headers=_auth(author_token),
        json={"title": "Своя правка"},
    )
    assert own.status_code == 200, own.text
    assert own.json()["title"] == "Своя правка"


def test_admin_can_manage_any_news(client: TestClient) -> None:
    manager_token, _ = _register(client, "cntr_manager")
    created = _create_news(client, manager_token, title="Новость менеджера")
    post_id = created.json()["id"]

    admin_token, _ = _register(client, "cntr_admin")
    patch = client.patch(
        f"/api/v1/news/{post_id}",
        headers=_auth(admin_token),
        json={"title": "Правка админа"},
    )
    assert patch.status_code == 200, patch.text


# ── Статусы и жизненный цикл ────────────────────────────────────────────────


def test_publish_unpublish_cycle(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    created = _create_news(client, token, title="Цикл")
    post_id = created.json()["id"]
    assert created.json()["status"] == "draft"
    assert created.json()["published_at"] is None

    pub = client.post(
        f"/api/v1/news/{post_id}/publish", headers=_auth(token)
    )
    assert pub.status_code == 200, pub.text
    assert pub.json()["status"] == "published"
    assert pub.json()["published_at"] is not None

    feed = client.get("/api/v1/news")
    assert any(i["id"] == post_id for i in feed.json()["items"])

    unpub = client.post(
        f"/api/v1/news/{post_id}/unpublish", headers=_auth(token)
    )
    assert unpub.status_code == 200, unpub.text
    assert unpub.json()["status"] == "draft"
    assert unpub.json()["published_at"] is None

    feed2 = client.get("/api/v1/news")
    assert all(i["id"] != post_id for i in feed2.json()["items"])


def test_patch_published_keeps_published_at(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    created = _create_news(client, token, title="До", status="published")
    post_id = created.json()["id"]
    published_at = created.json()["published_at"]

    patch = client.patch(
        f"/api/v1/news/{post_id}",
        headers=_auth(token),
        json={"title": "После"},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["title"] == "После"
    assert patch.json()["published_at"] == published_at


def test_schedule_requires_future_time(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    past = datetime.now(UTC) - timedelta(hours=1)
    response = _create_news(
        client,
        token,
        status="scheduled",
        scheduled_at=past.isoformat(),
    )
    assert response.status_code == 422, response.text

    no_time = _create_news(client, token, status="scheduled")
    assert no_time.status_code == 422, no_time.text

    future = datetime.now(UTC) + timedelta(hours=3)
    ok = _create_news(
        client,
        token,
        title="Запланировано",
        status="scheduled",
        scheduled_at=future.isoformat(),
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["status"] == "scheduled"
    assert ok.json()["scheduled_at"] is not None


# ── Контент-завод guard (спека §5) ──────────────────────────────────────────


def test_source_and_auto_flag_guards(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    auto = _create_news(client, token, source="auto")
    assert auto.status_code == 422, auto.text

    flag = _create_news(client, token, created_automatically=True)
    assert flag.status_code == 422, flag.text


# ── Категории, теги, фильтры ────────────────────────────────────────────────


def test_category_tag_filter_and_soft_tags(client: TestClient) -> None:
    cat_id = _seed_category("cat-filter")
    token, _ = _register(client, "cntr_admin")
    created = _create_news(
        client,
        token,
        title="С фильтром",
        category_id=cat_id,
        tags=["новый-тег", "центр"],
        status="published",
    )
    assert created.status_code == 201, created.text

    by_cat = client.get("/api/v1/news", params={"category": "cat-filter"})
    assert by_cat.status_code == 200, by_cat.text
    assert any(i["title"] == "С фильтром" for i in by_cat.json()["items"])

    by_tag = client.get("/api/v1/news", params={"tag": "новый-тег"})
    assert by_tag.status_code == 200, by_tag.text
    assert any(i["title"] == "С фильтром" for i in by_tag.json()["items"])

    wrong = client.get("/api/v1/news", params={"category": "net-takoy"})
    assert wrong.json()["total"] == 0


def test_unknown_category_rejected(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    response = _create_news(client, token, category_id=999_999)
    assert response.status_code == 422, response.text


# ── Media ───────────────────────────────────────────────────────────────────


def test_media_upload_and_delete(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    created = _create_news(client, token, title="С картинкой")
    post_id = created.json()["id"]

    upload = client.post(
        f"/api/v1/news/{post_id}/media",
        headers=_auth(token),
        files={"file": ("oblozhka.png", io.BytesIO(PNG_BYTES), "image/png")},
        data={"kind": "cover"},
    )
    assert upload.status_code == 201, upload.text
    media = upload.json()
    assert media["kind"] == "cover"
    assert media["mime_type"] == "image/png"

    detail = client.get(
        f"/api/v1/news/{post_id}", headers=_auth(token)
    )
    assert detail.json()["cover_key"] == media["storage_key"]
    assert len(detail.json()["media"]) == 1

    delete = client.delete(
        f"/api/v1/news/{post_id}/media/{media['id']}",
        headers=_auth(token),
    )
    assert delete.status_code == 204, delete.text

    detail2 = client.get(
        f"/api/v1/news/{post_id}", headers=_auth(token)
    )
    assert detail2.json()["cover_key"] is None
    assert detail2.json()["media"] == []


def test_media_upload_bad_mime_rejected(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    created = _create_news(client, token, title="Без картинки")
    post_id = created.json()["id"]

    upload = client.post(
        f"/api/v1/news/{post_id}/media",
        headers=_auth(token),
        files={
            "file": (
                "virus.exe",
                io.BytesIO(b"MZ\x90\x00" + b"\x00" * 64),
                "application/octet-stream",
            )
        },
        data={"kind": "inline"},
    )
    assert upload.status_code == 422, upload.text


# ── Удаление новости и /mine ────────────────────────────────────────────────


def test_delete_news(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    created = _create_news(client, token, title="На удаление", status="published")
    post_id = created.json()["id"]

    delete = client.delete(
        f"/api/v1/news/{post_id}", headers=_auth(token)
    )
    assert delete.status_code == 204, delete.text

    feed = client.get("/api/v1/news")
    assert all(i["id"] != post_id for i in feed.json()["items"])


def test_mine_returns_own_all_statuses(client: TestClient) -> None:
    token, _ = _register(client, "cntr_manager")
    _create_news(client, token, title="Своя 1", status="published")
    _create_news(client, token, title="Своя 2")

    mine = client.get("/api/v1/news/mine", headers=_auth(token))
    assert mine.status_code == 200, mine.text
    titles = [n["title"] for n in mine.json()]
    assert "Своя 1" in titles and "Своя 2" in titles

    guest_token, _ = _register(client, "gk_customer")
    guest = client.get("/api/v1/news/mine", headers=_auth(guest_token))
    assert guest.status_code == 200, guest.text
    assert guest.json() == []
