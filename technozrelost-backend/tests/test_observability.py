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


def test_unique_ids_do_not_explode_cardinality(client: TestClient) -> None:
    """R03i/история 5: 1000 запросов с уникальными ID не растят число серий.

    Шов HTTP: дергаем параметризованный роут с уникальными ID и пачку
    неизвестных путей, затем считаем DISTINCT значений метки route= в
    exposition /metrics. Ожидаем: шаблон /api/v1/news/{news_id} + одна
    bounded-метка для несопоставленных + служебные — не более 5 значений,
    сырых ID в теле нет.
    """
    metrics.reset()
    for i in range(1000):
        # несуществующий int-ID: роут сматчен, handler отдаёт 404
        assert client.get(f"/api/v1/news/{900000 + i}").status_code == 404
    for i in range(200):
        assert client.get(f"/api/v1/no-such-endpoint-{i}").status_code == 404
    body = client.get("/api/v1/metrics").text
    routes = set(
        re.findall(r'^technozrelost_http_requests_total\{[^}]*route="([^"]*)"', body, re.M)
    )
    assert '/api/v1/news/{news_id}' in routes
    assert len(routes) <= 5, f"кардинальность взорвалась: {sorted(routes)}"
    assert "no-such-endpoint-" not in body


def test_http_unknown_path_uses_bounded_label(client: TestClient) -> None:
    """R03i/история 5: несопоставленные пути — одна bounded-метка.

    Сырой path в метки не попадает никогда, иначе кардинальность растёт
    от входных данных (спека, §2).
    """
    metrics.reset()
    assert client.get("/api/v1/no-such-endpoint").status_code == 404
    body = client.get("/api/v1/metrics").text
    assert 'route="unmatched"' in body
    assert "no-such-endpoint" not in body


_METRIC_LINE_RE = re.compile(r"^[a-z_:][a-z0-9_:]*(\{[^{}]*\})? [0-9eE+.\-]+$")


def _exposition_data_lines(body: str) -> list[str]:
    """Непустые не-комментарные строки exposition."""
    return [ln for ln in body.splitlines() if ln and not ln.startswith("#")]


def test_nasty_path_does_not_break_exposition(client: TestClient) -> None:
    """R03i/история 5: путь с кавычкой/бэкслэшем не ломает разбор /metrics."""
    metrics.reset()
    assert client.get("/api/v1/%22quoted%22%5Cpath%0Ainjection").status_code == 404
    response = client.get("/api/v1/metrics")
    assert response.status_code == 200
    body = response.text
    assert 'route="unmatched"' in body
    assert "quoted" not in body
    for line in _exposition_data_lines(body):
        assert _METRIC_LINE_RE.match(line), f"строка ломает exposition: {line!r}"


def test_label_values_escaped_in_exposition() -> None:
    """R03i/история 5: значения меток экранируются по exposition 0.0.4."""
    metrics.reset()
    metrics.observe_http("GET", '/api/v1/we"ird\\route\nx', 200, 0.01)
    body = metrics.render()
    assert 'route="/api/v1/we\\"ird\\\\route\\nx"' in body
    for line in _exposition_data_lines(body):
        assert _METRIC_LINE_RE.match(line), f"строка ломает exposition: {line!r}"


def test_duration_count_sum_stay_cumulative_after_window(
    client: TestClient,
) -> None:
    """R03i/история 5: _count/_sum монотонны после окна 500 сэмплов.

    Шов HTTP: нагрузка — тем же observe_http, что зовёт middleware, чтение —
    через GET /metrics. Дашборд считает среднее как rate(sum)/rate(count).
    """
    metrics.reset()
    for _ in range(600):
        metrics.observe_http("GET", "/api/v1/health", 200, 0.02)
    body = client.get("/api/v1/metrics").text
    count = re.search(
        r'technozrelost_http_request_duration_seconds_count'
        r'\{method="GET",route="/api/v1/health"\} (\d+)',
        body,
    )
    assert count is not None, f"count-серия не найдена:\n{body}"
    assert int(count.group(1)) == 600
    total = re.search(
        r'technozrelost_http_request_duration_seconds_sum'
        r'\{method="GET",route="/api/v1/health"\} ([0-9.]+)',
        body,
    )
    assert total is not None, f"sum-серия не найдена:\n{body}"
    assert abs(float(total.group(1)) - 12.0) < 0.01


def test_two_replicas_scrape_as_separate_instances(client: TestClient) -> None:
    """R03i/история 5: приложение не ставит app-level instance-меток.

    Инстанс различает сам Prometheus по цели скрапа; серии одноименны,
    а счётчики двух реплик складываются (агрегаты сходятся).
    """
    metrics.reset()
    body = client.get("/api/v1/metrics").text
    assert "instance=" not in body
    assert "pod=" not in body
    assert "hostname=" not in body
    metrics.reset()
    for _ in range(3):
        metrics.observe_http("GET", "/api/v1/health", 200, 0.01)
    replica_a = metrics.render()
    metrics.reset()
    for _ in range(5):
        metrics.observe_http("GET", "/api/v1/health", 200, 0.01)
    replica_b = metrics.render()

    def total_count(exposition: str) -> int:
        match = re.search(
            r'^technozrelost_http_requests_total\{method="GET",'
            r'route="/api/v1/health",status="200"\} (\d+)$',
            exposition,
            re.M,
        )
        assert match, f"серия не найдена:\n{exposition}"
        return int(match.group(1))

    assert total_count(replica_a) == 3
    assert total_count(replica_b) == 5
    assert total_count(replica_a) + total_count(replica_b) == 8
    def names(exposition: str) -> list[str]:
        return sorted({ln.split("{")[0] for ln in _exposition_data_lines(exposition)})
    assert names(replica_a) == names(replica_b)


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
