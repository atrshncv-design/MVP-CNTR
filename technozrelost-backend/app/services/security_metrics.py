"""In-memory метрики безопасности и аудита (тикет 03 security-infrastructure).

Счётчики контуров auth/files и HTTP-отказов 403/429. In-memory (per-process,
сбрасываются при рестарте), по образцу app/services/ai_metrics.py; рендерятся
в /api/v1/metrics вместе с общими Prometheus-метриками.

События инкрементятся в бизнес-логике (auth.py, files.py) и в
PrometheusMetricsMiddleware (403/429); snapshot() — потокобезопасен.
"""

from __future__ import annotations

import threading

_lock = threading.Lock()

_COUNTERS: dict[str, int] = {
    # auth
    "auth_login_success_total": 0,
    "auth_login_failed_total": 0,
    "auth_login_locked_total": 0,
    "auth_register_total": 0,
    # files
    "files_uploads_total": 0,
    "files_downloads_total": 0,
    "files_infected_total": 0,
    "files_rescans_total": 0,
    # HTTP-отказы (в middleware по фактическому статусу ответа)
    "http_403_total": 0,
    "http_429_total": 0,
}


def _inc(name: str) -> None:
    with _lock:
        _COUNTERS[name] += 1


def auth_login_success() -> None:
    _inc("auth_login_success_total")


def auth_login_failed() -> None:
    _inc("auth_login_failed_total")


def auth_login_locked() -> None:
    _inc("auth_login_locked_total")


def auth_register() -> None:
    _inc("auth_register_total")


def files_uploaded() -> None:
    _inc("files_uploads_total")


def files_downloaded() -> None:
    _inc("files_downloads_total")


def files_infected() -> None:
    _inc("files_infected_total")


def files_rescanned() -> None:
    _inc("files_rescans_total")


def http_denied(status_code: int) -> None:
    """403/429 счётчики по фактическому статусу ответа (middleware)."""
    if status_code == 403:
        _inc("http_403_total")
    elif status_code == 429:
        _inc("http_429_total")


def snapshot() -> dict[str, int]:
    with _lock:
        return dict(_COUNTERS)


def reset() -> None:
    """Сброс всех счётчиков (используется в тестах)."""
    with _lock:
        for key in _COUNTERS:
            _COUNTERS[key] = 0
