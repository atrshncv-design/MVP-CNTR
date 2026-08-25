"""Троттлинг неудачных логинов (R05.5, защита от брутфорса).

Скользящее окно на пару (email-хеш, источник запроса): после LIMIT неудачных
попыток за окно логин этого аккаунта с этого источника отклоняется 429.
Успешный вход сбрасывает счётчик пары. In-memory — как ai_metrics: при
нескольких воркерах лимит делится между процессами (приемлемо для MVP,
для кластера — Redis, см. отчёт таска 04).
"""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict

from fastapi import Request

LIMIT = 10
WINDOW_SECONDS = 60.0

_attempts: dict[str, list[float]] = defaultdict(list)


def _key(email: str, client_host: str) -> str:
    digest = hashlib.sha256(email.strip().lower().encode()).hexdigest()
    return f"{digest}:{client_host}"


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


def is_blocked(email: str, client_host: str) -> bool:
    now = time.monotonic()
    stamps = _attempts[_key(email, client_host)]
    while stamps and now - stamps[0] > WINDOW_SECONDS:
        stamps.pop(0)
    return len(stamps) >= LIMIT


def record_failure(email: str, client_host: str) -> None:
    _attempts[_key(email, client_host)].append(time.monotonic())


def record_success(email: str, client_host: str) -> None:
    _attempts.pop(_key(email, client_host), None)


def reset() -> None:
    """Сброс состояния (тесты)."""
    _attempts.clear()
