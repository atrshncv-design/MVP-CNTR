"""Отложенная публикация новостей (спека §3.4, тикет 05).

Фоновая задача в lifespan приложения раз в 60 секунд вызывает
``process_scheduled_posts``: статус в БД — источник истины, поэтому
задача переживает рестарты. Уведомления о публикации — §3.6.
"""

from __future__ import annotations

from sqlalchemy import text

from app.core.deps import DBSession
from app.db.models import NewsPost
from app.services.notifications import notify_news_published

# Интервал фонового постинга (сек), спека §3.4.
SCHEDULER_INTERVAL_SECONDS = 60


async def process_scheduled_posts(db: DBSession) -> list[int]:
    """Публикует запланированные новости (``scheduled_at <= now()``).

    ``UPDATE ... WHERE status='scheduled' AND scheduled_at <= now()
    RETURNING id`` — атомарно и идемпотентно; по возвращённым id
    рассылаются уведомления «Новость: {title}» всем пользователям.
    """
    result = await db.execute(
        text(
            """
            UPDATE public.news_posts
            SET status = 'published',
                published_at = COALESCE(published_at, now()),
                scheduled_at = NULL,
                updated_at = now()
            WHERE status = 'scheduled' AND scheduled_at <= now()
            RETURNING id
            """
        )
    )
    ids = [row[0] for row in result.fetchall()]
    if not ids:
        await db.commit()
        return ids
    # Сбрасываем identity map: raw UPDATE мог опередить закэшированные
    # строки ORM (статус в БД — истина).
    db.expire_all()
    for news_id in ids:
        post = await db.get(NewsPost, news_id)
        if post is not None:
            await notify_news_published(db, news_id, post.title)
    await db.commit()
    return ids
