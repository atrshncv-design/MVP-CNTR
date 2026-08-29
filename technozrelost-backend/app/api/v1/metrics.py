"""Prometheus-эндпоинт GET /api/v1/metrics (тикет 20 + INF-10/18/19).

Собирает счётчики из app.services.metrics и дополняет их живыми gauge'ами:
- очередь: количество записей notification_outbox со статусом pending;
- хранилище: доступность MinIO и число объектов в бакете;
- репликация: лаг из pg_stat_replication / pg_replication_slots (INF-10);
- ClamAV CVD: возраст сигнатур (INF-18);
- версионирование бакета MinIO (INF-19).

Эндпоинт публичный (как и /health): метрики не содержат секретов/ПДн.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter
from fastapi.responses import Response
from sqlalchemy import func, select, text

from app.core.database import SessionLocal
from app.db.models import NotificationOutbox
from app.services import metrics
from app.services.file_storage import clamav_cvd_age_seconds, storage

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


async def _replica_lag_bytes() -> int:
    """INF-10: лаг реплики из pg_stat_replication (replay_lag байт)."""
    try:
        async with SessionLocal() as session:
            row = await session.execute(
                text(
                    "SELECT COALESCE(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn), 0)::bigint "
                    "FROM pg_stat_replication ORDER BY backend_start DESC LIMIT 1"
                )
            )
            val = row.scalar_one_or_none()
            return int(val) if val is not None else 0
    except Exception:  # noqa: BLE001
        return 0


async def _slot_retained_bytes() -> int:
    """INF-10: удержанный WAL слота репликации из pg_replication_slots."""
    try:
        import os

        slot_name = os.getenv("REPL_SLOT", "tz_replica_slot")
        async with SessionLocal() as session:
            row = await session.execute(
                text(
                    "SELECT COALESCE(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn),0)::bigint "
                    "FROM pg_replication_slots WHERE slot_name = :slot"
                ),
                {"slot": slot_name},
            )
            val = row.scalar_one_or_none()
            return int(val) if val is not None else 0
    except Exception:  # noqa: BLE001
        return 0


@router.get("/metrics", summary="Prometheus metrics", tags=["metrics"])
async def metrics_endpoint() -> Response:
    (
        queue_pending,
        storage_up,
        storage_objects,
        replica_lag,
        slot_retained,
        cvd_age,
        versioning,
    ) = await asyncio.gather(
        _queue_pending_count(),
        asyncio.to_thread(storage.health),
        asyncio.to_thread(storage.object_count),
        _replica_lag_bytes(),
        _slot_retained_bytes(),
        clamav_cvd_age_seconds(),
        asyncio.to_thread(storage.bucket_versioning_enabled),
    )
    body = metrics.render(
        queue_pending=int(queue_pending),  # type: ignore[arg-type]
        storage_up=1 if storage_up else 0,
        storage_objects=int(storage_objects),  # type: ignore[arg-type]
        replica_lag_bytes=int(replica_lag),  # type: ignore[arg-type]
        slot_retained_bytes=int(slot_retained),  # type: ignore[arg-type]
        clamav_cvd_age_seconds=cvd_age,
        storage_versioning=1 if versioning else 0,
    )
    return Response(
        content=body,
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
