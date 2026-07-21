from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.health import router as health_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # startup hooks (connexion pool warm-up и т.п.) — здесь
    yield
    # shutdown hooks — здесь


def create_app() -> FastAPI:
    app = FastAPI(
        title="Technozrelost Backend",
        version="0.1.0",
        description="B2B/B2G инфраструктура для ЦНТР по ГОСТ Р 58048-2017.",
        lifespan=lifespan,
    )
    app.include_router(health_router, prefix="/api/v1")
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_env == "dev",
    )
