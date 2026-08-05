"""Prometheus-эндпоинт GET /api/v1/metrics (тикет 20).

Собирает счётчики из app.services.metrics и дополняет их живыми gauge'ами:
- очередь: количество записей notification_outbox со статусом pending;
- хранилище: доступность MinIO и число объектов в бакете.

Эндпоинт публичный (как и /health): метрики не содержат секретов/ПДн.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter
from fastapi.responses import Response
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.db.models import NotificationOutbox
from app.services import metrics
from app.services.file_storage import storage

router = APIRouter(tags=["metrics"])


async def _queue_pending_count() -> int:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(func.count()).select_from(NotificationOutbox).where(
                    NotificationOutbox.status == "pending"
                )
            )
            return int(result.scalar_one())
    except Exception:  # noqa: BLE001 -- метрики не должны ронять scrape
        return 0


@router.get("/metrics", summary="Prometheus metrics", tags=["metrics"])
async def metrics_endpoint() -> Response:
    queue_pending, storage_up, storage_objects = await asyncio.gather(
        _queue_pending_count(),
        asyncio.to_thread(storage.health),
        asyncio.to_thread(storage.object_count),
    )
    body = metrics.render(
        queue_pending=queue_pending,
        storage_up=1 if storage_up else 0,
        storage_objects=storage_objects,
    )
    return Response(
        content=body,
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
