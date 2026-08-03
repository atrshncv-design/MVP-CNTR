from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.assessments import router as assessments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.executors import router as executors_router
from app.api.v1.generation import router as generation_router
from app.api.v1.health import router as health_router
from app.api.v1.manager import router as manager_router
from app.api.v1.membership import router as membership_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.projects import router as projects_router
from app.api.v1.rag import router as rag_router
from app.api.v1.stages import router as stages_router
from app.api.v1.technologies import router as technologies_router
from app.api.v1.users import router as users_router
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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")
    app.include_router(membership_router, prefix="/api/v1")
    app.include_router(rag_router, prefix="/api/v1")
    app.include_router(generation_router, prefix="/api/v1")
    app.include_router(executors_router, prefix="/api/v1")
    app.include_router(technologies_router, prefix="/api/v1")
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(users_router, prefix="/api/v1")
    app.include_router(assessments_router, prefix="/api/v1")
    app.include_router(manager_router, prefix="/api/v1")
    app.include_router(notifications_router, prefix="/api/v1")
    app.include_router(stages_router, prefix="/api/v1")
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
