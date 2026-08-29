"""Троттлинг неудачных логинов (R05.5, защита от брутфорса).

Скользящее окно на пару (email-хеш, источник запроса): после LIMIT неудачных
попыток за окно логин этого аккаунта с этого источника отклоняется 429.
Успешный вход сбрасывает счётчик пары.

P-04 Redis fixed window: 10/60s через INCR EXPIRE 60 на общем Redis
(две реплики не удваивают лимит). Fallback — LRU/TTL in-memory 5k/60s
при недоступности Redis (как ai_metrics, но с LRU). Redis must for prod,
LRU only fallback — см. SPEC-07 / ADR-0015 (I-02): при 5001 IP ротации
LRU evict обходит лимит, Redis mitigates.

N-07 LRU/TTL: OrderedDict max 5k, TTL 60s, move_to_end на доступ.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import logging
import time
from collections import OrderedDict
from typing import Any

from fastapi import Request

from app.core.config import settings

logger = logging.getLogger(__name__)

LIMIT = 10
WINDOW_SECONDS = 60.0
MAX_ENTRIES = 5000

_attempts: OrderedDict[str, list[float]] = OrderedDict()

_redis_client: Any | None = None
_redis_checked: bool = False


def _key(email: str, client_host: str) -> str:
    digest = hashlib.sha256(email.strip().lower().encode()).hexdigest()
    return f"{digest}:{client_host}"


def _get_redis() -> Any | None:
    """Ленивый Redis-клиент для fixed window; None если REDIS_URL пуст/недоступен."""
    global _redis_client, _redis_checked
    url = settings.redis_url
    if not url:
        return None
    if _redis_checked and _redis_client is None:
        # предыдущая попытка провалилась — не спамим коннектами каждый запрос
        # но при каждом вызове пробуем снова? упростим: пытаемся каждый раз
        pass
    try:
        import redis

        if _redis_client is None:
            _redis_client = redis.Redis.from_url(
                url, socket_connect_timeout=1, socket_timeout=1, decode_responses=False
            )
        # ping проверяет доступность, без него fallback должен сработать
        _redis_client.ping()
        _redis_checked = True
        return _redis_client
    except Exception:  # noqa: BLE001
        _redis_checked = True
        _redis_client = None
        return None


def _reset_redis_cache() -> None:
    global _redis_client, _redis_checked
    _redis_client = None
    _redis_checked = False


def source_from_request(request: Request) -> str:
    """Источник запроса для лимита.

    Приоритет: X-Real-IP — его ставит наш nginx из $remote_addr, поэтому он не
    контролируется клиентом. Фолбэк — ПОСЛЕДНИЙ хоп X-Forwarded-For:
    $proxy_add_x_forwarded_for дописывает реальный IP последним, а первые хопы
    клиент подделывает свободно (ротация обходила бы лимит). Иначе — client.host.
    """
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        last_hop = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        if last_hop:
            return last_hop[-1]
    return request.client.host if request.client else "unknown"


async def is_blocked(email: str, client_host: str) -> bool:
    key = _key(email, client_host)
    # Redis fixed window (P-04): если Redis доступен — он источник истины
    # async via to_thread — Redis sync I/O не блокирует event loop (H-02a, SPEC-02)
    try:
        client = await asyncio.to_thread(_get_redis)
        if client is not None:
            rkey = f"throttle:{key}"
            val = await asyncio.to_thread(client.get, rkey)
            if val is not None:
                try:
                    count = int(val)
                except (ValueError, TypeError):
                    count = 0
                if count >= LIMIT:
                    return True
            return False
    except Exception:  # noqa: BLE001 — fallback на LRU
        pass
    # Fallback LRU/TTL (N-07)
    now = time.monotonic()
    stamps = _attempts.get(key)
    if stamps is None:
        return False
    while stamps and now - stamps[0] > WINDOW_SECONDS:
        stamps.pop(0)
    if not stamps:
        with contextlib.suppress(KeyError):
            del _attempts[key]
        return False
    with contextlib.suppress(KeyError):
        _attempts.move_to_end(key)
    return len(stamps) >= LIMIT


async def record_failure(email: str, client_host: str) -> None:
    key = _key(email, client_host)
    # Redis fixed window INCR EXPIRE 60 (P-04) — async via to_thread (H-02a)
    try:
        client = await asyncio.to_thread(_get_redis)
        if client is not None:
            rkey = f"throttle:{key}"
            count = int(await asyncio.to_thread(client.incr, rkey))
            if count == 1:
                await asyncio.to_thread(client.expire, rkey, int(WINDOW_SECONDS))
            else:
                # если ключ остался без TTL (кринж-конфиг Redis) — ставим
                try:
                    ttl = await asyncio.to_thread(client.ttl, rkey)
                    if ttl == -1:
                        await asyncio.to_thread(client.expire, rkey, int(WINDOW_SECONDS))
                except Exception:  # noqa: BLE001
                    pass
            return
    except Exception:  # noqa: BLE001
        pass
    # Fallback LRU (N-07): append + evict старейший при переполнении
    now = time.monotonic()
    stamps = _attempts.get(key)
    if stamps is None:
        stamps = []
        _attempts[key] = stamps
    else:
        while stamps and now - stamps[0] > WINDOW_SECONDS:
            stamps.pop(0)
        with contextlib.suppress(KeyError):
            _attempts.move_to_end(key)
    stamps.append(now)
    while len(_attempts) > MAX_ENTRIES:
        _attempts.popitem(last=False)
    # I-02 / SPEC-07 FR-04: early warning при заполнении LRU
    # Redis must for prod, LRU only fallback
    if len(_attempts) > 4000:
        logger.warning(
            "throttle LRU near capacity: %s entries (threshold 4000/5000) "
            "— Redis must for prod, LRU only fallback per ADR-0015",
            len(_attempts),
        )


async def record_success(email: str, client_host: str) -> None:
    key = _key(email, client_host)
    try:
        client = await asyncio.to_thread(_get_redis)
        if client is not None:
            await asyncio.to_thread(client.delete, f"throttle:{key}")
    except Exception:  # noqa: BLE001
        pass
    _attempts.pop(key, None)


def reset() -> None:
    """Сброс состояния (тесты)."""
    _attempts.clear()
    _reset_redis_cache()
    # для тестов с Redis — чистим ключи throttle:* best-effort
    url = settings.redis_url
    if url:
        try:
            import redis

            client = redis.Redis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
            for k in client.scan_iter(match="throttle:*", count=200):
                client.delete(k)
        except Exception:  # noqa: BLE001
            pass
