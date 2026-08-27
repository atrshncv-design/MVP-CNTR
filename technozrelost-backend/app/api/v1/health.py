from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import engine, read_engine

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "technozrelost-backend"}


@router.get("/ready", summary="Readiness probe")
async def ready() -> dict[str, object]:
    databases = await check_databases()
    payload: dict[str, object] = {"status": "ready", "databases": databases}
    if "unavailable" in databases.values():
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
