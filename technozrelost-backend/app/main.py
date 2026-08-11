from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.account import router as account_router
from app.api.v1.admin import router as admin_router
from app.api.v1.assessments import router as assessments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.consents import router as consents_router
from app.api.v1.executors import router as executors_router
from app.api.v1.experts import expert_router as expert_router
from app.api.v1.experts import router as experts_router
from app.api.v1.files import router as files_router
from app.api.v1.generation import router as generation_router
from app.api.v1.health import router as health_router
from app.api.v1.invites import router as invites_router
from app.api.v1.ip_registry import router as ip_registry_router
from app.api.v1.manager import router as manager_router
from app.api.v1.membership import router as membership_router
from app.api.v1.metrics import router as metrics_router
from app.api.v1.mfa import router as mfa_router
from app.api.v1.nioktr import router as nioktr_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.organizations import router as organizations_router
from app.api.v1.profiles import router as profiles_router
from app.api.v1.projects import router as projects_router
from app.api.v1.rag import router as rag_router
from app.api.v1.realtime import router as realtime_router
from app.api.v1.requests import router as requests_router
from app.api.v1.stages import router as stages_router
from app.api.v1.stages import stage_router as stage_router
from app.api.v1.support_programs import router as support_programs_router
from app.api.v1.tech_requests import (
    disclosures_router as tech_request_disclosures_router,
)
from app.api.v1.tech_requests import (
    offers_router as tech_request_offers_router,
)
from app.api.v1.tech_requests import (
    router as tech_requests_router,
)
from app.api.v1.technologies import router as technologies_router
from app.api.v1.users import router as users_router
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.services.metrics import PrometheusMetricsMiddleware, install_db_listeners

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # MFA (тикет 02): ключ шифрования TOTP-секретов обязателен вне тестовой
    # среды — старт падает с понятным сообщением, а не деградирует молча.
    if settings.app_env != "test" and not settings.mfa_secret_encryption_key:
        raise RuntimeError(
            "MFA_SECRET_ENCRYPTION_KEY не задан: шифрование MFA-секретов невозможно. "
            "Задайте ключ в .env (см. .env.example)."
        )
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
    app.include_router(mfa_router, prefix="/api/v1")
    app.include_router(consents_router, prefix="/api/v1")
    app.include_router(account_router, prefix="/api/v1")
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
    app.include_router(users_router, prefix="/api/v1")
    app.include_router(assessments_router, prefix="/api/v1")
    app.include_router(manager_router, prefix="/api/v1")
    app.include_router(notifications_router, prefix="/api/v1")
    app.include_router(metrics_router, prefix="/api/v1")
    app.include_router(profiles_router, prefix="/api/v1")
    app.include_router(organizations_router, prefix="/api/v1")
    app.include_router(stages_router, prefix="/api/v1")
    app.include_router(stage_router, prefix="/api/v1")
    app.include_router(experts_router, prefix="/api/v1")
    app.include_router(expert_router, prefix="/api/v1")
    app.include_router(ip_registry_router, prefix="/api/v1")
    app.include_router(support_programs_router, prefix="/api/v1")
    app.include_router(tech_requests_router, prefix="/api/v1")
    app.include_router(tech_request_offers_router, prefix="/api/v1")
    app.include_router(tech_request_disclosures_router, prefix="/api/v1")
    app.include_router(nioktr_router, prefix="/api/v1")
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
