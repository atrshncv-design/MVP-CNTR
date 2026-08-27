"""Метрики AI-консультанта (тикет 14): отдельные счётчики, не влияющие на платформу."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Any

# Счётчики запросов AI-консультанта (in-memory; сбрасываются при рестарте)
METRICS: dict[str, Any] = {
    "requests_total": 0,
    "errors_total": 0,
    "fallbacks_total": 0,
    "timeouts_total": 0,
    "rate_limited_total": 0,
    "requests_by_user": defaultdict(int),
    "latency_seconds_total": 0.0,
}

# Простой скользящий лимит: N запросов за окно секунд на пользователя
RATE_LIMIT: dict[str, int] = {"limit": 30, "window_seconds": 60}
_user_window: dict[int, list[float]] = defaultdict(list)


def allow_request(user_id: int) -> bool:
    """True, если запрос пользователя в пределах лимита."""
    now = time.monotonic()
    window = RATE_LIMIT["window_seconds"]
    stamp_list = _user_window[user_id]
    while stamp_list and now - stamp_list[0] > window:
        stamp_list.pop(0)
    if len(stamp_list) >= RATE_LIMIT["limit"]:
        METRICS["rate_limited_total"] += 1
        return False
    stamp_list.append(now)
    return True


def snapshot() -> dict[str, Any]:
    """Снимок метрик для /metrics/ai (без per-user карты)."""
    data = {k: v for k, v in METRICS.items() if k != "requests_by_user"}
    data["requests_by_user"] = dict(METRICS["requests_by_user"])
    return data
