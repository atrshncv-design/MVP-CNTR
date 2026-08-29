from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, DBSession
from app.schemas import ChatIn, ChatOut
from app.services import ai_metrics
from app.services.ai_assistant import process_chat

router = APIRouter(prefix="/chat", tags=["chat"])

AI_RATE_LIMIT_MESSAGE = (
    "Слишком много запросов к AI-консультанту — подождите минуту "
    "или задайте вопрос более конкретно."
)


async def _handle_chat(
    payload: ChatIn, db: DBSession, user: CurrentUser, contour: str | None = None
) -> ChatOut:
    """Общий обработчик с контур-фильтром tuno/kaba (rag.py:26)."""

    if not ai_metrics.allow_request(user.id):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, AI_RATE_LIMIT_MESSAGE)

    ai_metrics.METRICS["requests_total"] += 1
    ai_metrics.METRICS["requests_by_user"][user.id] += 1
    started = time.monotonic()
    result = await process_chat(db, payload, user, contour=contour)
    ai_metrics.METRICS["latency_seconds_total"] += time.monotonic() - started
    return result


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

    return await _handle_chat(payload, db, user, contour=None)


@router.post("/tuno", response_model=ChatOut)
async def chat_tuno(
    payload: ChatIn,
    db: DBSession,
    user: CurrentUser,
) -> ChatOut:
    """Контур Туно: реестры/организации (tuno) — изолирован WHERE contour='tuno'."""

    return await _handle_chat(payload, db, user, contour="tuno")


@router.post("/kaba", response_model=ChatOut)
async def chat_kaba(
    payload: ChatIn,
    db: DBSession,
    user: CurrentUser,
) -> ChatOut:
    """Контур Каба: ГОСТ/методология (kaba) — изолирован WHERE contour='kaba'."""

    return await _handle_chat(payload, db, user, contour="kaba")


@router.get("/metrics/ai")
async def ai_metrics_endpoint(user: CurrentUser) -> dict[str, Any]:
    """Отдельные метрики AI-консультанта (доступны авторизованным)."""
    return ai_metrics.snapshot()
