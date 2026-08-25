"""Тикет 06: отложенная публикация новостей и уведомления (спека §3.4, §3.6).

Покрытие:
- Запланированная новость не видна в публичной ленте и анониму в detail
  (404) до наступления scheduled_at; автор видит свою как scheduled.
- process_scheduled_posts (прямой вызов — так его зовёт lifespan-таск)
  публикует запланированное: status=published, published_at=now(), видна
  в публичной ленте; будущие scheduled не трогает.
- Публикация (ручная и отложенная) создаёт уведомление «Новость: {title}»
  каждому активному пользователю: Notification + outbox-запись (project
  scope, delivered) в той же транзакции (transactional outbox).
- publish уже опубликованной — идемпотентен (200, published_at не меняется,
  уведомления не дублируются); schedule опубликованной — 409.
- schedule → unpublish: возврат в draft, обработчик её не трогает.

Паттерны: register_test_user (tests/support.py), прямой psycopg для
«прошлого» scheduled_at (API принимает только будущее) — как в test_news.py.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta

import psycopg
from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "cntr_admin") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("news06"), full_name="Новости06", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _db_conn() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
    )


def _create_news(client: TestClient, token: str, **overrides):
    payload = {
        "title": "Новость о центре",
        "content": "<p>Содержимое новости</p>",
        "tags": ["центр"],
        "status": "draft",
        **overrides,
    }
    return client.post("/api/v1/news", headers=_auth(token), json=payload)


def _set_past_scheduled(post_id: int) -> None:
    """Прошлое scheduled_at напрямую в БД: API принимает только будущее."""
    conn = _db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE public.news_posts "
                "SET scheduled_at = now() - interval '1 hour' "
                "WHERE id = %s",
                (post_id,),
            )
        conn.commit()
    finally:
        conn.close()


def _run_scheduler() -> list[int]:
    """Прямой вызов обработчика отложенной публикации (как lifespan-таск)."""
    from app.services.news_scheduler import process_scheduled_posts

    async def _run() -> list[int]:
        from app.core.database import SessionLocal

        async with SessionLocal() as db:
            return await process_scheduled_posts(db)

    return asyncio.run(_run())


def _active_user_ids() -> list[int]:
    conn = _db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM public.users WHERE is_active = TRUE ORDER BY id"
            )
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def _news_notification_counts(news_id: int) -> tuple[int, int]:
    """(строк в notifications, строк в outbox) для публикации новости."""
    conn = _db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) FROM public.notifications "
                "WHERE type = 'news_published' "
                "AND payload->>'news_id' = %s",
                (str(news_id),),
            )
            notif_row = cur.fetchone()
            assert notif_row is not None
            notif = notif_row[0]
            cur.execute(
                "SELECT count(*) FROM public.notification_outbox o "
                "JOIN public.notifications n ON n.id = o.notification_id "
                "WHERE n.type = 'news_published' "
                "AND n.payload->>'news_id' = %s",
                (str(news_id),),
            )
            outbox_row = cur.fetchone()
            assert outbox_row is not None
            outbox = outbox_row[0]
        return notif, outbox
    finally:
        conn.close()


def _news_titles() -> set[str]:
    """Все заголовки уведомлений news_published в БД."""
    conn = _db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT title FROM public.notifications "
                "WHERE type = 'news_published'"
            )
            return {row[0] for row in cur.fetchall()}
    finally:
        conn.close()


# ── Видимость запланированного ──────────────────────────────────────────────


def test_scheduled_news_hidden_until_time(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    future = datetime.now(UTC) + timedelta(hours=3)
    created = _create_news(
        client,
        token,
        title="Запланирована на потом",
        status="scheduled",
        scheduled_at=future.isoformat(),
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]
    assert created.json()["status"] == "scheduled"

    feed = client.get("/api/v1/news")
    assert feed.status_code == 200, feed.text
    assert all(item["id"] != post_id for item in feed.json()["items"])

    anon = client.get(f"/api/v1/news/{post_id}")
    assert anon.status_code == 404, anon.text

    # Автор видит свою запланированную.
    author = client.get(f"/api/v1/news/{post_id}", headers=_auth(token))
    assert author.status_code == 200, author.text
    assert author.json()["status"] == "scheduled"


# ── Обработчик отложенной публикации ────────────────────────────────────────


def test_scheduler_publishes_past_scheduled(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    future = datetime.now(UTC) + timedelta(hours=3)
    created = _create_news(
        client,
        token,
        title="Время пришло",
        status="scheduled",
        scheduled_at=future.isoformat(),
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    _set_past_scheduled(post_id)

    published_ids = _run_scheduler()
    assert post_id in published_ids

    detail = client.get(f"/api/v1/news/{post_id}", headers=_auth(token))
    assert detail.status_code == 200, detail.text
    assert detail.json()["status"] == "published"
    assert detail.json()["published_at"] is not None

    feed = client.get("/api/v1/news")
    assert any(item["id"] == post_id for item in feed.json()["items"])


def test_scheduler_skips_future_scheduled(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    future = datetime.now(UTC) + timedelta(hours=3)
    created = _create_news(
        client,
        token,
        title="Ещё рано",
        status="scheduled",
        scheduled_at=future.isoformat(),
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    assert _run_scheduler() == []

    detail = client.get(f"/api/v1/news/{post_id}", headers=_auth(token))
    assert detail.json()["status"] == "scheduled"


# ── Уведомления при публикации (спека §3.6) ─────────────────────────────────


def test_scheduled_publish_notifies_all_active_users(client: TestClient) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    _register(client, "gk_customer")
    _register(client, "gk_customer")

    future = datetime.now(UTC) + timedelta(hours=3)
    created = _create_news(
        client,
        admin_token,
        title="Всем на заметку",
        status="scheduled",
        scheduled_at=future.isoformat(),
    )
    post_id = created.json()["id"]
    _set_past_scheduled(post_id)

    assert _run_scheduler() == [post_id]

    active = _active_user_ids()
    assert len(active) >= 3
    notif, outbox = _news_notification_counts(post_id)
    assert notif == len(active)
    assert outbox == notif

    assert _news_titles() == {"Новость: Всем на заметку"}

    # In-app: админ видит уведомление в центре уведомлений.
    inbox = client.get("/api/v1/notifications", headers=_auth(admin_token))
    assert inbox.status_code == 200, inbox.text
    titles = [n["title"] for n in inbox.json()]
    assert "Новость: Всем на заметку" in titles


def test_manual_publish_creates_notification(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    _register(client, "gk_customer")

    created = _create_news(client, token, title="Ручная публикация")
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    pub = client.post(f"/api/v1/news/{post_id}/publish", headers=_auth(token))
    assert pub.status_code == 200, pub.text

    active = _active_user_ids()
    assert len(active) >= 2
    notif, outbox = _news_notification_counts(post_id)
    assert notif == len(active)
    assert outbox == notif
    assert _news_titles() == {"Новость: Ручная публикация"}


# ── Идемпотентность и cancel-пути ───────────────────────────────────────────


def test_publish_published_is_idempotent(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    _register(client, "gk_customer")

    created = _create_news(client, token, title="Идемпотентная публикация")
    post_id = created.json()["id"]

    first = client.post(f"/api/v1/news/{post_id}/publish", headers=_auth(token))
    assert first.status_code == 200, first.text
    published_at = first.json()["published_at"]

    notif_after_first, _ = _news_notification_counts(post_id)
    assert notif_after_first == len(_active_user_ids())

    second = client.post(f"/api/v1/news/{post_id}/publish", headers=_auth(token))
    assert second.status_code == 200, second.text
    assert second.json()["status"] == "published"
    assert second.json()["published_at"] == published_at

    notif_after_second, outbox_after_second = _news_notification_counts(post_id)
    assert notif_after_second == notif_after_first  # дублей нет
    assert outbox_after_second == notif_after_second


def test_schedule_published_conflict(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    created = _create_news(client, token, title="Уже в эфире", status="published")
    post_id = created.json()["id"]

    future = datetime.now(UTC) + timedelta(hours=2)
    resp = client.post(
        f"/api/v1/news/{post_id}/schedule",
        headers=_auth(token),
        json={"scheduled_at": future.isoformat()},
    )
    assert resp.status_code == 409, resp.text


def test_schedule_then_unpublish_cancels(client: TestClient) -> None:
    token, _ = _register(client, "cntr_admin")
    created = _create_news(client, token, title="Отменить план")
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]

    future = datetime.now(UTC) + timedelta(hours=3)
    scheduled = client.post(
        f"/api/v1/news/{post_id}/schedule",
        headers=_auth(token),
        json={"scheduled_at": future.isoformat()},
    )
    assert scheduled.status_code == 200, scheduled.text
    assert scheduled.json()["status"] == "scheduled"
    assert scheduled.json()["scheduled_at"] is not None

    unpub = client.post(f"/api/v1/news/{post_id}/unpublish", headers=_auth(token))
    assert unpub.status_code == 200, unpub.text
    assert unpub.json()["status"] == "draft"

    # Обработчик не трогает снятую с публикации новость.
    assert _run_scheduler() == []
    detail = client.get(f"/api/v1/news/{post_id}", headers=_auth(token))
    assert detail.json()["status"] == "draft"
