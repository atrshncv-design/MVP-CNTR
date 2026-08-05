"""Prometheus-метрики платформы (тикет 20).

- HTTP: счётчик запросов по (method, route-шаблон, status) + summary
  латентности (p50/p95/sum/count) через ASGI-middleware.
- DB: счётчики выполненных SQL-запросов (SQLAlchemy event listeners).
- Очередь и хранилище — gauge'и, заполняются живыми данными в
  app/api/v1/metrics.py (len(notification_outbox pending), MinIO health/objects).

Рендер — собственный Prometheus text exposition (version 0.0.4), без внешних
зависимостей; форматы совместимы с Prometheus/Grafana.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Any

from sqlalchemy import event

from app.core.database import engine, read_engine

_MAX_SAMPLES_PER_ROUTE = 500

_http_total: dict[tuple[str, str, str], int] = defaultdict(int)
_http_duration_samples: dict[tuple[str, str], deque[float]] = defaultdict(
    lambda: deque(maxlen=_MAX_SAMPLES_PER_ROUTE)
)
_db_queries_total = 0
_db_query_errors_total = 0
_lock = threading.Lock()

_listeners_installed = False


def reset() -> None:
    """Сбрасывает все счётчики (используется в тестах)."""
    with _lock:
        _http_total.clear()
        _http_duration_samples.clear()
        globals().update(_db_queries_total=0, _db_query_errors_total=0)


def observe_http(method: str, route: str, status: int, duration_seconds: float) -> None:
    with _lock:
        _http_total[(method, route, str(status))] += 1
        _http_duration_samples[(method, route)].append(duration_seconds)


def db_query_observed() -> None:
    with _lock:
        globals()["_db_queries_total"] += 1


def db_query_error_observed() -> None:
    with _lock:
        globals()["_db_query_errors_total"] += 1


def _quantile(sorted_samples: list[float], q: float) -> float:
    if not sorted_samples:
        return 0.0
    return sorted_samples[min(int(q * (len(sorted_samples) - 1)), len(sorted_samples) - 1)]


def _fmt(value: float) -> str:
    return f"{value:.6f}"


def render(queue_pending: int = 0, storage_up: int = 0, storage_objects: int = 0) -> str:
    """Prometheus text exposition (version 0.0.4)."""
    with _lock:
        http_total = sorted(_http_total.items())
        duration_snapshots = {
            key: sorted(samples) for key, samples in _http_duration_samples.items()
        }
        db_queries_total = _db_queries_total
        db_query_errors_total = _db_query_errors_total

    lines: list[str] = []
    lines.append(
        "# HELP technozrelost_http_requests_total HTTP-запросы по методу, "
        "route-шаблону и статусу."
    )
    lines.append("# TYPE technozrelost_http_requests_total counter")
    for (method, route, status), count in http_total:
        lines.append(
            f'technozrelost_http_requests_total{{method="{method}",'
            f'route="{route}",status="{status}"}} {count}'
        )

    lines.append(
        "# HELP technozrelost_http_request_duration_seconds "
        "Латентность HTTP-запросов, секунды."
    )
    lines.append("# TYPE technozrelost_http_request_duration_seconds summary")
    for (method, route), samples in sorted(duration_snapshots.items()):
        sample_sum = sum(samples)
        lines.append(
            f'technozrelost_http_request_duration_seconds{{method="{method}",'
            f'route="{route}",quantile="0.5"}} {_fmt(_quantile(samples, 0.5))}'
        )
        lines.append(
            f'technozrelost_http_request_duration_seconds{{method="{method}",'
            f'route="{route}",quantile="0.95"}} {_fmt(_quantile(samples, 0.95))}'
        )
        lines.append(
            f'technozrelost_http_request_duration_seconds_sum{{method="{method}",'
            f'route="{route}"}} {_fmt(sample_sum)}'
        )
        lines.append(
            f'technozrelost_http_request_duration_seconds_count{{method="{method}",'
            f'route="{route}"}} {len(samples)}'
        )

    lines.append("# HELP technozrelost_db_queries_total SQL-запросы к БД (Primary).")
    lines.append("# TYPE technozrelost_db_queries_total counter")
    lines.append(f"technozrelost_db_queries_total {db_queries_total}")
    lines.append("# HELP technozrelost_db_query_errors_total Ошибки SQL-запросов (Primary).")
    lines.append("# TYPE technozrelost_db_query_errors_total counter")
    lines.append(f"technozrelost_db_query_errors_total {db_query_errors_total}")

    lines.append(
        "# HELP technozrelost_notification_outbox_pending "
        "Записей outbox в статусе pending."
    )
    lines.append("# TYPE technozrelost_notification_outbox_pending gauge")
    lines.append(f"technozrelost_notification_outbox_pending {queue_pending}")

    lines.append("# HELP technozrelost_storage_up Доступность объектного хранилища (1/0).")
    lines.append("# TYPE technozrelost_storage_up gauge")
    lines.append(f"technozrelost_storage_up {storage_up}")
    lines.append("# HELP technozrelost_storage_objects Количество объектов в бакете MinIO.")
    lines.append("# TYPE technozrelost_storage_objects gauge")
    lines.append(f"technozrelost_storage_objects {storage_objects}")

    return "\n".join(lines) + "\n"


class PrometheusMetricsMiddleware:
    """ASGI-middleware: считает HTTP-запросы и латентность (тикет 20).

    Чистая ASGI (не BaseHTTPMiddleware) — не буферизует стримы (SSE) и
    не вмешивается в ответы. Route-шаблон берётся из маппинга endpoint → путь
    (Starlette кладёт endpoint в scope при роутинге); для не-роутed путей
    (404 и т.п.) используется сырой path.
    """

    def __init__(self, app: Any, route_templates: dict[int, str] | None = None) -> None:
        self.app = app
        self.route_templates = route_templates or {}

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        method = scope.get("method", "GET")
        route = self.route_templates.get(id(scope.get("endpoint")), scope.get("path", "") or "")
        started = time.perf_counter()
        status = {"code": 500}

        async def wrapped_send(message: dict[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                status["code"] = int(message.get("status", 500))
                observe_http(method, route, status["code"], time.perf_counter() - started)
            await send(message)

        try:
            await self.app(scope, receive, wrapped_send)
        except Exception:
            observe_http(method, route, status["code"], time.perf_counter() - started)
            raise


def _before_cursor_execute(
    conn: Any,
    cursor: Any,
    statement: str,
    parameters: Any,
    context: Any,
    executemany: bool,
) -> None:
    db_query_observed()


def _handle_error(context: Any) -> None:
    db_query_error_observed()


def install_db_listeners() -> None:
    """Навешивает счётчики SQL-запросов на Primary (и Replica, если задана)."""
    global _listeners_installed
    if _listeners_installed:
        return
    event.listen(engine.sync_engine, "before_cursor_execute", _before_cursor_execute)
    event.listen(engine.sync_engine, "handle_error", _handle_error)
    if read_engine is not None:
        event.listen(read_engine.sync_engine, "before_cursor_execute", _before_cursor_execute)
    _listeners_installed = True
