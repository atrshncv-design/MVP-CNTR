"""Тикет 20: наблюдаемость — Prometheus-метрики и JSON-логи без секретов."""

from __future__ import annotations

import json
import logging
import re

from fastapi.testclient import TestClient

from app.core.logging_config import JsonFormatter, redact
from app.services import metrics


def _metric_value(body: str, name: str) -> int:
    match = re.search(rf"^{re.escape(name)}(?:\{{[^}}]*\}})? (\d+)$", body, re.M)
    assert match, f"метрика {name} не найдена в:\n{body}"
    return int(match.group(1))


def test_metrics_endpoint_returns_prometheus_text(client: TestClient) -> None:
    metrics.reset()
    response = client.get("/api/v1/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    body = response.text
    for metric in (
        "technozrelost_http_requests_total",
        "technozrelost_http_request_duration_seconds",
        "technozrelost_db_queries_total",
        "technozrelost_db_query_errors_total",
        "technozrelost_notification_outbox_pending",
        "technozrelost_storage_up",
        "technozrelost_storage_objects",
    ):
        assert metric in body


def test_http_counter_uses_route_template(client: TestClient) -> None:
    metrics.reset()
    assert client.get("/api/v1/health").status_code == 200
    body = client.get("/api/v1/metrics").text
    assert 'route="/api/v1/health"' in body
    assert 'status="200"' in body
    assert _metric_value(body, "technozrelost_http_requests_total") >= 1


def test_http_unknown_path_falls_back_to_raw_path(client: TestClient) -> None:
    metrics.reset()
    assert client.get("/api/v1/no-such-endpoint").status_code == 404
    body = client.get("/api/v1/metrics").text
    assert 'route="/api/v1/no-such-endpoint"' in body


def test_db_queries_counter_increments(client: TestClient) -> None:
    metrics.reset()
    # /api/v1/ready выполняет SQL-запросы к Primary; метрики добавляют ещё один
    assert client.get("/api/v1/ready").status_code == 200
    body = client.get("/api/v1/metrics").text
    assert _metric_value(body, "technozrelost_db_queries_total") >= 1


def test_queue_and_storage_gauges(client: TestClient) -> None:
    metrics.reset()
    body = client.get("/api/v1/metrics").text
    # метрики присутствуют; значения gauge зависят от общего состояния БД/хранилища
    assert _metric_value(body, "technozrelost_notification_outbox_pending") >= 0
    assert _metric_value(body, "technozrelost_storage_up") == 1
    assert _metric_value(body, "technozrelost_storage_objects") >= 0


def test_redact_masks_secrets_and_emails() -> None:
    assert redact("password=hunter2 остальное") == "password=*** остальное"
    assert redact("Authorization: Bearer eyJhbGci.abc") == "Authorization: ***"
    assert redact("GET /stream?access_token=eyJ.abc HTTP/1.1") == (
        "GET /stream?access_token=*** HTTP/1.1"
    )
    assert redact("refresh_token=qwerty") == "refresh_token=***"
    assert redact("api_key=secret123") == "api_key=***"
    assert redact("email user@example.com ok") == "email ***@*** ok"
    assert "hunter2" not in redact("pwd=hunter2")
    # обычный текст не портится
    plain = "Технозрелость: миграции применены, готово к работе"
    assert redact(plain) == plain


def test_json_formatter_redacts_log_records() -> None:
    record = logging.LogRecord(
        "app.test",
        logging.INFO,
        __file__,
        1,
        "login password=%s email=%s token=%s",
        ("hunter2", "user@example.com", "abc123"),
        None,
    )
    payload = json.loads(JsonFormatter().format(record))
    assert payload["level"] == "INFO"
    assert payload["logger"] == "app.test"
    message = payload["message"]
    for secret in ("hunter2", "user@example.com", "abc123"):
        assert secret not in message
    assert "***" in message
