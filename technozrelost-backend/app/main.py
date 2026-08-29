from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import text
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.v1.achievements import (
    project_router as project_achievements_router,
)
from app.api.v1.achievements import router as achievements_router
from app.api.v1.admin import router as admin_router
from app.api.v1.assessments import router as assessments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.executors import router as executors_router
from app.api.v1.files import router as files_router
from app.api.v1.generation import router as generation_router
from app.api.v1.health import router as health_router
from app.api.v1.invites import router as invites_router
from app.api.v1.manager import router as manager_router
from app.api.v1.match import router as match_router
from app.api.v1.membership import router as membership_router
from app.api.v1.metrics import router as metrics_router
from app.api.v1.news import router as news_router
from app.api.v1.nioktr import router as nioktr_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.profiles import router as profiles_router
from app.api.v1.projects import router as projects_router
from app.api.v1.rag import router as rag_router
from app.api.v1.realtime import router as realtime_router
from app.api.v1.requests import router as requests_router
from app.api.v1.stages import router as stages_router
from app.api.v1.technologies import router as technologies_router
from app.api.v1.users import router as users_router
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging_config import setup_logging
from app.services.metrics import PrometheusMetricsMiddleware, install_db_listeners
from app.services.news_scheduler import (
    SCHEDULER_INTERVAL_SECONDS,
    process_scheduled_posts,
)

setup_logging()

logger = logging.getLogger(__name__)


async def _news_scheduler_loop() -> None:
    """Отложенная публикация новостей: раз в 60 секунд.

    Статус в БД — источник истины; задача переживает рестарты приложения.
    P-03 advisory lock pg_try_advisory_lock(42): при replicas=2 только один
    инстанс обрабатывает отложенные новости за итерацию.
    """
    while True:
        try:
            async with SessionLocal() as session:
                # advisory lock 42 — singleton планировщика на уровне БД
                got_lock = await session.scalar(text("SELECT pg_try_advisory_lock(42)"))
                if not got_lock:
                    logger.debug("news scheduler skipped: lock held")
                    await session.rollback()
                else:
                    try:
                        await process_scheduled_posts(session)
                    finally:
                        await session.execute(text("SELECT pg_advisory_unlock(42)"))
        except Exception:  # noqa: BLE001 — цикл не должен умирать
            logger.exception("news scheduler iteration failed")
        await asyncio.sleep(SCHEDULER_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    scheduler_task: asyncio.Task[None] | None = None
    if settings.app_env != "test":
        # В тестах фоновый цикл не запускаем: обработчик вызывается напрямую.
        scheduler_task = asyncio.create_task(_news_scheduler_loop())
    yield
    if scheduler_task is not None:
        scheduler_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await scheduler_task


# Глобальный лимит тела запроса (R05.5/R16). С известной длиной — проверка
# заголовка до чтения; для chunked-запросов без Content-Length — чтение потока
# до лимита+1 и ответ 413 (иначе тело воспроизводится обработчику).
# Глобальная переменная, а не константа класса: тесты переопределяют лимит
# через monkeypatch на модуль. Потоковые загрузки дополнительно режет
# read_upload_limited внутри обработчиков.
max_request_body_bytes = settings.max_request_body_mb * 1024 * 1024

_TOO_LARGE = JSONResponse(
    {"detail": "Тело запроса превышает допустимый размер"},
    status_code=413,
)


class LimitRequestBodyMiddleware:
    """Чистый ASGI-middleware: контроль над receive без приватных атрибутов Request."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        raw_length = headers.get("content-length")
        if raw_length is not None:
            # Длина заявлена: достаточно сверить заголовок, поток не трогаем.
            if raw_length.isdigit() and int(raw_length) > max_request_body_bytes:
                await _TOO_LARGE(scope, receive, send)
                return
            await self.app(scope, receive, send)
            return

        buffered = bytearray()
        while True:
            message = await receive()
            mtype = message["type"]
            if mtype == "http.disconnect":
                return
            chunk: bytes = message.get("body", b"") if mtype == "http.request" else b""
            if chunk:
                buffered.extend(chunk)
                # лимит+1: ровно на границе ещё проходим, байт сверх — уже нет
                if len(buffered) > max_request_body_bytes:
                    await _TOO_LARGE(scope, receive, send)
                    return
            if mtype == "http.request" and not message.get("more_body", False):
                break

        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": bytes(buffered), "more_body": False}
            return {"type": "http.disconnect"}

        await self.app(scope, replay, send)


async def security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    # OWASP-базовая линия (R05): минимальные заголовки защиты на всех ответах
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


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
    app.add_middleware(LimitRequestBodyMiddleware)
    app.middleware("http")(security_headers)
    # Метрики: route-шаблоны для меток (Starlette кладёт endpoint в scope при
    # роутинге; маппинг endpoint -> путь даёт ограниченную кардинальность).
    route_templates: dict[int, str] = {}
    for route in app.routes:
        endpoint = getattr(route, "endpoint", None)
        path = getattr(route, "path", None)
        if endpoint is not None and path is not None:
            route_templates[id(endpoint)] = path
    app.add_middleware(PrometheusMetricsMiddleware, route_templates=route_templates)
    install_db_listeners()
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(invites_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")
    app.include_router(requests_router, prefix="/api/v1")
    app.include_router(realtime_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(membership_router, prefix="/api/v1")
    app.include_router(rag_router, prefix="/api/v1")
    app.include_router(generation_router, prefix="/api/v1")
    app.include_router(executors_router, prefix="/api/v1")
    app.include_router(files_router, prefix="/api/v1")
    app.include_router(technologies_router, prefix="/api/v1")
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(match_router, prefix="/api/v1")
    app.include_router(users_router, prefix="/api/v1")
    app.include_router(assessments_router, prefix="/api/v1")
    app.include_router(manager_router, prefix="/api/v1")
    app.include_router(notifications_router, prefix="/api/v1")
    app.include_router(metrics_router, prefix="/api/v1")
    app.include_router(profiles_router, prefix="/api/v1")
    app.include_router(stages_router, prefix="/api/v1")
    app.include_router(nioktr_router, prefix="/api/v1")
    app.include_router(news_router, prefix="/api/v1")
    app.include_router(achievements_router, prefix="/api/v1")
    app.include_router(project_achievements_router, prefix="/api/v1")
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_env == "dev",
        log_config=None,  # JSON-логи уже настроены в setup_logging()
    )
