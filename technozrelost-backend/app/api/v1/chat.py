from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, DBSession
from app.schemas import ChatIn, ChatOut
from app.services import ai_metrics
from app.services.ai_assistant import process_chat
from app.services.kill_switches import ensure_enabled

router = APIRouter(prefix="/chat", tags=["chat"])

AI_RATE_LIMIT_MESSAGE = (
    "Слишком много запросов к AI-консультанту — подождите минуту "
    "или задайте вопрос более конкретно."
)


@router.post("", response_model=ChatOut)
async def chat(
    payload: ChatIn,
    db: DBSession,
    user: CurrentUser,
) -> ChatOut:
    """AI-консультант: RAG + LLM с fallback, лимитами и метриками (тикет 14).

    AI — справочный слой: не меняет проект, УГТ или требования; ошибка
    провайдера или таймаут не влияют на основную платформу (fallback).
    """
    ensure_enabled("ai")  # kill switch: AI-контур off → 503
    if not ai_metrics.allow_request(user.id):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, AI_RATE_LIMIT_MESSAGE)

    ai_metrics.METRICS["requests_total"] += 1
    ai_metrics.METRICS["requests_by_user"][user.id] += 1
    started = time.monotonic()
    result = await process_chat(db, payload, user)
    ai_metrics.METRICS["latency_seconds_total"] += time.monotonic() - started
    return result


@router.get("/metrics/ai")
async def ai_metrics_endpoint(user: CurrentUser) -> dict:
    """Отдельные метрики AI-консультанта (доступны авторизованным)."""
    return ai_metrics.snapshot()
