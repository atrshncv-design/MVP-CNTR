"""Kill switches (тикет 03 security-infrastructure): независимое отключение контуров.

Четыре независимых контура, каждый со своим флагом:
- registration   — POST /auth/register (саморегистрация);
- uploads        — POST /projects/{id}/files (загрузка файлов);
- external_access — публичные (анонимные) endpoints: реестры исполнителей,
  организаций, НИОКТР и проектов;
- ai             — AI-контур: POST /chat + LLM-вызовы (ask_llm).

Источник истины — settings (env/дефолты). Штатное переключение на лету —
staff-эндпоинт /admin/kill-switches (in-memory override, thread-safe);
при рестарте процесса состояние возвращается к значениям settings.
Отключённый контур отвечает 503 (для AI — 503 на /chat, LLM-вызовы
деградируют как «модель недоступна»).
"""

from __future__ import annotations

import threading

from fastapi import HTTPException, status

from app.core.config import settings

CIRCUITS = ("registration", "uploads", "external_access", "ai")

DEFAULT_MESSAGES = {
    "registration": "Регистрация временно отключена",
    "uploads": "Загрузка файлов временно отключена",
    "external_access": "Внешний доступ временно отключён",
    "ai": "AI-контур временно отключён",
}

_lock = threading.Lock()
_runtime: dict[str, bool] = {}


def _initial(name: str) -> bool:
    return {
        "registration": settings.registration_enabled,
        "uploads": settings.uploads_enabled,
        "external_access": settings.external_access_enabled,
        "ai": settings.ai_enabled,
    }[name]


def is_enabled(name: str) -> bool:
    """Текущее состояние контура (runtime override или значение settings)."""
    with _lock:
        if name not in _runtime:
            _runtime[name] = _initial(name)
        return _runtime[name]


def set_enabled(name: str, enabled: bool) -> None:
    """Переключает контур на лету (только валидные имена)."""
    if name not in CIRCUITS:
        raise ValueError(f"Неизвестный контур: {name}")
    with _lock:
        _runtime[name] = enabled


def snapshot() -> dict[str, bool]:
    """Состояние всех контуров (для staff-эндпоинта и метрик)."""
    return {name: is_enabled(name) for name in CIRCUITS}


def reset() -> None:
    """Сбрасывает runtime-переопределения к значениям settings (тесты)."""
    with _lock:
        _runtime.clear()


def ensure_enabled(name: str) -> None:
    """Raises 503, если контур отключён. Вызывается в начале gated-эндпоинта."""
    if not is_enabled(name):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            DEFAULT_MESSAGES.get(name, "Контур временно отключён"),
        )
