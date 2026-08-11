"""Серверные rate limits и cost gate публичного /rag/chat (тикет 04 ai-rag).

Защита от Denial of Wallet и злоупотреблений — СЕРВЕРНАЯ, НЕ client state:

Rate limits (по IP):
- частота: `rag_rate_limit_per_window` запросов за окно
  `rag_rate_limit_window_minutes` (фиксированные окна, сдвиг окна = сброс);
- суточный: `rag_daily_request_limit` запросов на UTC-день;
- ключ — IP (`request.client.host`): смена session_id НЕ обнуляет ни
  частотный, ни суточный лимит; session_id хранится только для диагностики;
- счётчики — атомарный upsert `INSERT … ON CONFLICT DO UPDATE … RETURNING`;
- ПДн не хранятся: только IP + счётчики окон + updated_at (тексты вопросов,
  user-agent и прочее НЕ сохраняются); устаревшие строки чистятся по TTL.

Cost gate (глобальный, на всех посетителей):
- дневной бюджет: `rag_daily_budget_requests` запросов и
  `rag_daily_budget_tokens` токенов (оценка `len//4`) — таблица rag_cost_state,
  одна строка на UTC-день; превышение → 429 с честным сообщением;
- per-request потолок: `rag_per_request_max_tokens` — ответ обрезается до
  целевого размера (эвристика: max_tokens*4 символов);
- kill switch: `rag_kill_switch` — /rag/chat → 503, остальной API работает;
- кеш идентичных вопросов: in-memory с TTL (`rag_cache_ttl_seconds`), ключ —
  SHA-256 нормализованного вопроса (текст вопроса в кеше не хранится);
  cache hit не вызывает LLM и не тратит бюджет.

Метрики/логи: счётчики (запросы/отказы/лимиты/бюджет/токены) и
структурированные логи БЕЗ PII — тексты вопросов и session_id не логируются.
"""

from __future__ import annotations

import hashlib
import logging
import time
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import case, delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import RagCostState, RagRateLimitState
from app.schemas import RagConsultantOut

logger = logging.getLogger("app.services.rag_limits")

# ─── Ответы (честные, без внутренних деталей и правил) ──────────────────────

RATE_LIMIT_MESSAGE = "Слишком много запросов. Пожалуйста, попробуйте позже."
DAILY_LIMIT_MESSAGE = (
    "Достигнут суточный лимит запросов. Пожалуйста, попробуйте завтра."
)
BUDGET_MESSAGE = (
    "Дневной лимит обработки вопросов исчерпан. Пожалуйста, попробуйте завтра."
)
KILL_SWITCH_MESSAGE = (
    "Консультант временно недоступен. Пожалуйста, попробуйте позже."
)

# ─── Метрики (без PII: только счётчики) ──────────────────────────────────────

RAG_METRICS: dict[str, int] = {
    "requests_total": 0,  # все запросы /rag/chat
    "refusals_total": 0,  # отказы (off-topic/ambiguous/нет материалов)
    "rate_limited_total": 0,  # 429 по частоте/суточному лимиту
    "budget_blocked_total": 0,  # 429 по дневному бюджету
    "kill_switch_total": 0,  # 503 по kill switch
    "llm_calls_total": 0,  # вызовы LLM (cache hit не считается)
    "cache_hits_total": 0,  # ответы из кеша идентичных вопросов
    "input_tokens_total": 0,  # оценка входных токенов
    "output_tokens_total": 0,  # оценка выходных токенов
}


def rag_metrics_snapshot() -> dict[str, int]:
    """Снимок счётчиков /rag/chat (без PII)."""
    return dict(RAG_METRICS)


def rag_metrics_reset() -> None:
    """Сброс счётчиков (используется в тестах для изоляции)."""
    for key in RAG_METRICS:
        RAG_METRICS[key] = 0


def log_rag_event(event: str, **fields: int | str) -> None:
    """Структурированный лог события /rag/chat — БЕЗ вопросов и session_id."""
    logger.info("rag.chat", extra={"rag_chat": {"event": event, **fields}})


# ─── Вспомогательное ─────────────────────────────────────────────────────────


def estimate_tokens(text: str) -> int:
    """Эвристическая оценка токенов (≈4 символа/токен для RU/EN смеси).

    Для cost gate достаточно оценки: точный токенизатор не нужен, пороги
    вынесены в settings. Никогда не возвращает 0 (минимальная стоимость 1).
    """
    return max(1, len(text) // 4)


def cap_output_tokens(reply: str) -> str:
    """Обрезает ответ до целевого потолка rag_per_request_max_tokens.

    Эвристика: max_tokens * 4 символов. Не даёт клиенту/кешу ответ больше
    настроенного per-request лимита токенов.
    """
    max_chars = settings.rag_per_request_max_tokens * 4
    if len(reply) <= max_chars:
        return reply
    return reply[: max_chars - 1].rstrip() + "…"


def _freq_window_start(now: datetime) -> datetime:
    """Начало фиксированного окна частоты (кратно window_minutes)."""
    minutes = settings.rag_rate_limit_window_minutes
    slot = (now.minute // minutes) * minutes
    return now.replace(minute=slot, second=0, microsecond=0)


def _seconds_until(next_moment: datetime, now: datetime) -> int:
    return max(1, int((next_moment - now).total_seconds()))


def _retry_after_window(window_start: datetime, now: datetime) -> int:
    return _seconds_until(
        window_start + timedelta(minutes=settings.rag_rate_limit_window_minutes), now
    )


def _retry_after_daily(now: datetime) -> int:
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return _seconds_until(midnight, now)


async def _cleanup_stale(db: AsyncSession) -> None:
    """TTL-чистка устаревших строк лимитов/бюджета (дешёвая, таблицы малы)."""
    cutoff = datetime.now(UTC) - timedelta(days=2)
    await db.execute(
        delete(RagRateLimitState).where(RagRateLimitState.updated_at < cutoff)
    )
    await db.execute(delete(RagCostState).where(RagCostState.updated_at < cutoff))


# ─── Rate limits (по IP, атомарный upsert) ───────────────────────────────────


async def enforce_rate_limits(db: AsyncSession, ip: str, session_id: str) -> None:
    """Серверные лимиты частоты и суточный: 429 при превышении (по IP).

    Атомарный инкремент обоих счётчиков одним upsert'ом (без select-then-update
    гонок). Окна фиксированные: сдвиг окна частоты/смены дня сбрасывает
    соответствующий счётчик к 1. Отклонённые запросы тоже считаются
    (злоупотребление быстрее исчерпывает лимиты). Смена session_id ничего
    не обнуляет — ключ лимитов IP.
    """
    now = datetime.now(UTC)
    window_start = _freq_window_start(now)
    today = now.date()

    await _cleanup_stale(db)

    stmt = pg_insert(RagRateLimitState).values(
        ip=ip,
        session_id=session_id,
        freq_window_start=window_start,
        freq_count=1,
        daily_date=today,
        daily_count=1,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["ip"],
        set_={
            "session_id": session_id,
            "freq_window_start": window_start,
            "freq_count": case(
                (RagRateLimitState.freq_window_start < window_start, 1),
                else_=RagRateLimitState.freq_count + 1,
            ),
            "daily_date": today,
            "daily_count": case(
                (RagRateLimitState.daily_date < today, 1),
                else_=RagRateLimitState.daily_count + 1,
            ),
            "updated_at": func.now(),
        },
    ).returning(RagRateLimitState.freq_count, RagRateLimitState.daily_count)

    row = (await db.execute(stmt)).one()
    await db.commit()
    freq_count = int(row[0])
    daily_count = int(row[1])

    # Суточный лимит проверяется первым (жёсткий потолок на день).
    if daily_count > settings.rag_daily_request_limit:
        RAG_METRICS["rate_limited_total"] += 1
        log_rag_event("daily_limit", daily_count=daily_count, ip_hash=_ip_digest(ip))
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=DAILY_LIMIT_MESSAGE,
            headers={"Retry-After": str(_retry_after_daily(now))},
        )
    if freq_count > settings.rag_rate_limit_per_window:
        RAG_METRICS["rate_limited_total"] += 1
        log_rag_event(
            "freq_limit",
            freq_count=freq_count,
            window_minutes=settings.rag_rate_limit_window_minutes,
            ip_hash=_ip_digest(ip),
        )
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=RATE_LIMIT_MESSAGE,
            headers={"Retry-After": str(_retry_after_window(window_start, now))},
        )


def _ip_digest(ip: str) -> str:
    """Короткий необратимый отпечаток IP для логов (без хранения самого IP)."""
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()[:12]


# ─── Cost gate: дневной бюджет ───────────────────────────────────────────────


async def rag_daily_budget_exceeded(db: AsyncSession) -> bool:
    """Превышен ли дневной бюджет (запросы или токены, глобально на день).

    Приближённый gate (select-then-act): допускается overshoot на один запрос
    при параллельных запросах — бюджет защищает кошелёк, а не ведёт точный учёт.
    """
    today = datetime.now(UTC).date()
    stmt = select(RagCostState).where(RagCostState.day == today)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        return False
    tokens = row.input_tokens + row.output_tokens
    return (
        row.request_count >= settings.rag_daily_budget_requests
        or tokens >= settings.rag_daily_budget_tokens
    )


async def record_rag_usage(
    db: AsyncSession, *, input_chars: int, output_chars: int
) -> tuple[int, int, int]:
    """Атомарный учёт расхода дня: +1 запрос, +оценка входных/выходных токенов.

    Возвращает (request_count, input_tokens, output_tokens) после учёта —
    для логов (без PII).
    """
    today = datetime.now(UTC).date()
    input_tokens = max(1, input_chars // 4)
    output_tokens = max(1, output_chars // 4)

    stmt = pg_insert(RagCostState).values(
        day=today,
        request_count=1,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["day"],
        set_={
            "request_count": RagCostState.request_count + 1,
            "input_tokens": RagCostState.input_tokens + input_tokens,
            "output_tokens": RagCostState.output_tokens + output_tokens,
            "updated_at": func.now(),
        },
    ).returning(
        RagCostState.request_count,
        RagCostState.input_tokens,
        RagCostState.output_tokens,
    )

    row = (await db.execute(stmt)).one()
    await db.commit()
    return int(row[0]), int(row[1]), int(row[2])


def rag_kill_switch_active() -> bool:
    """Аварийное отключение /rag/chat (флаг settings; остальной API работает)."""
    return bool(settings.rag_kill_switch)


# ─── Кеш идентичных вопросов (in-memory, TTL, без текстов вопросов) ──────────

_CACHE_ENTRY = tuple[float, RagConsultantOut]
_rag_cache: dict[str, _CACHE_ENTRY] = {}


def _cache_key(question: str) -> str:
    normalized = question.strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def rag_cache_get(question: str) -> RagConsultantOut | None:
    """Ответ из кеша по нормализованному вопросу (None = промах/протух)."""
    entry = _rag_cache.get(_cache_key(question))
    if entry is None:
        return None
    expires_at, answer = entry
    if time.monotonic() > expires_at:
        _rag_cache.pop(_cache_key(question), None)
        return None
    return answer


def rag_cache_set(question: str, answer: RagConsultantOut) -> None:
    """Сохранение ответа в кеш (ключ — хеш вопроса; текст вопроса не хранится)."""
    key = _cache_key(question)
    _rag_cache[key] = (time.monotonic() + settings.rag_cache_ttl_seconds, answer)


def rag_cache_clear() -> None:
    """Полная очистка кеша (используется в тестах для изоляции)."""
    _rag_cache.clear()
