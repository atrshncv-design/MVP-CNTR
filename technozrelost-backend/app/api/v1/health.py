from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import settings
from app.core.database import engine, read_engine

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "technozrelost-backend"}


async def check_redis() -> str:
    """Состояние Redis для readiness (R03i, таск 01).

    - "ok" — REDIS_URL задан и ping успешен (общий лимит/SSE между репликами);
    - "not_configured" — REDIS_URL пуст (dev/test, локальный fallback);
    - "unavailable" — REDIS_URL задан, но ping провален (fail-closed: 503).
    В production пустой REDIS_URL невозможен — старт падает раньше (config guard).
    """
    url = settings.redis_url
    if not url:
        return "not_configured"
    try:
        import redis

        client = redis.Redis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
        await asyncio.to_thread(client.ping)
    except Exception:  # noqa: BLE001 -- readiness must fail closed without leaking details
        return "unavailable"
    return "ok"


async def check_storage() -> str:
    """Доступность объектного хранилища для readiness (P2, таск 14).

    - "ok" — бакет/каталог доступен;
    - "unavailable" — MinIO недоступен (fail-closed: 503).
    Блокирующий MinIO-клиент едет в threadpool, проба не вешает event loop.
    """
    from app.services.file_storage import storage

    try:
        healthy = await asyncio.to_thread(storage.health)
    except Exception:  # noqa: BLE001 -- readiness must fail closed without leaking details
        return "unavailable"
    return "ok" if healthy else "unavailable"


async def check_clamav() -> str:
    """Доступность антивирусного скана для readiness (P2, таск 14).

    - "disabled" — скан выключен конфигом/тестовым окружением (не провал);
    - "ok" — clamd ответил PONG;
    - "unavailable" — clamd недоступен (fail-closed: 503).
    """
    from app.services.file_storage import scanner

    if not scanner.enabled:
        return "disabled"
    return await asyncio.to_thread(_ping_clamav_sync)


def _ping_clamav_sync() -> str:
    import socket

    try:
        with socket.create_connection(
            (settings.clamav_host, settings.clamav_port), timeout=1
        ) as conn:
            conn.sendall(b"PING\n")
            conn.settimeout(1)
            reply = conn.recv(64)
        return "ok" if b"PONG" in reply else "unavailable"
    except Exception:  # noqa: BLE001 -- readiness must fail closed without leaking details
        return "unavailable"


@router.get("/ready", summary="Readiness probe")
async def ready() -> dict[str, object]:
    databases = await check_databases()
    redis_state = await check_redis()
    storage_state = await check_storage()
    clamav_state = await check_clamav()
    payload: dict[str, object] = {
        "status": "ready",
        "databases": databases,
        "redis": redis_state,
        "storage": storage_state,
        "clamav": clamav_state,
    }
    if (
        "unavailable" in databases.values()
        or redis_state == "unavailable"
        or storage_state == "unavailable"
        or clamav_state == "unavailable"
    ):
        payload["status"] = "not_ready"
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=payload)
    return payload


async def _check_engine(database_engine: AsyncEngine) -> str:
    try:
        async with database_engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 -- readiness must fail closed without leaking DB details
        return "unavailable"
    return "ok"


async def check_databases() -> dict[str, str]:
    databases = {"primary": await _check_engine(engine)}
    databases["replica"] = (
        await _check_engine(read_engine) if read_engine is not None else "not_configured"
    )
    return databases
