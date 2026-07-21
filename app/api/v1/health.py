from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "technozrelost-backend"}


@router.get("/ready", summary="Readiness probe")
async def ready() -> dict[str, object]:
    # TODO(1.2): проверка соединения с БД (primary + replica)
    return {"status": "ready"}  # noqa: ERA001
