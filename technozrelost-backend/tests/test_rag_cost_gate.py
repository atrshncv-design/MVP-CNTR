"""Тикет 04 ai-rag: abuse, rate limits и cost gate публичного /rag/chat.

Покрытие:
- Частотный лимит (10/15 мин, настраивается) → 429 с Retry-After; счётчики
  атомарны и серверные (БД rag_rate_limit_state, по IP).
- Суточный лимит (30/сутки) → 429; смена session_id НЕ обнуляет суточный
  лимит (ключ — IP; session_id только для диагностики).
- Input > 2000 символов → 422 (граница 2000 — ещё принимается).
- Дневной бюджет (запросы и токены, settings) → 429 с честным сообщением;
  кеш идентичных вопросов обслуживается ДО проверки бюджета (cache hit не
  тратит бюджет и не вызывает LLM).
- Kill switch → 503 на /rag/chat, остальной API работает; после снятия
  флага консультант снова отвечает.
- Метрики/логи не содержат текстов вопросов и session_id (без PII).

Зафиксированное решение: лимиты — по IP (серверная БД, атомарный upsert),
session_id хранится только для диагностики; в БД нет текстов вопросов и
прочих ПДн; кеш — in-memory с TTL, ключ — SHA-256 вопроса (текст не
хранится); дневной бюджет — глобальный (rag_cost_state, одна строка на
UTC-день), оценка токенов — эвристика len//4; kill switch — флаг settings.
Изоляция тестов — truncate новых таблиц + сброс кеша/метрик в conftest
(TestClient использует единый IP «testclient»).
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app as fastapi_app
from app.services.llm_client import get_rag_llm_client
from app.services.rag_limits import (
    BUDGET_MESSAGE,
    DAILY_LIMIT_MESSAGE,
    KILL_SWITCH_MESSAGE,
    RAG_METRICS,
    RATE_LIMIT_MESSAGE,
    cap_output_tokens,
    estimate_tokens,
    rag_metrics_snapshot,
)
from tests.support import register_test_user

RAG_TEXT = (
    "УГТ 5: компоненты технологии интегрированы и испытаны "
    "в условиях, близких к реальным."
)
MATCHING_QUERY = "УГТ 5 компоненты"
# Cosine с сид-документом ≥ 0.30 (проверено реальным эмбеддером: 0.474) — иначе
# консультант честно отказывает (refused) и LLM не вызывается (см. тикет 02).
OTHER_QUERY = "Как оценить УГТ 5 компоненты технологии?"


class FakeLLMClient:
    """Test-double LLM-провайдера: детерминированный ответ + запись вызовов."""

    def __init__(self, reply: str | None = "Ответ консультанта по материалам базы.") -> None:
        self.reply = reply
        self.calls: list[tuple[str, str]] = []

    async def complete(self, system_prompt: str, user_message: str) -> str | None:
        self.calls.append((system_prompt, user_message))
        return self.reply


@pytest.fixture()
def fake_llm() -> Iterator[FakeLLMClient]:
    fake = FakeLLMClient()
    fastapi_app.dependency_overrides[get_rag_llm_client] = lambda: fake
    yield fake
    fastapi_app.dependency_overrides.pop(get_rag_llm_client, None)


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "cntr_admin") -> str:
    return register_test_user(
        client,
        email=_email("staff"),
        full_name="Staff User",
        role_slug=role,
    )["access_token"]


def _seed_doc(client: TestClient, admin_token: str) -> dict:
    """Создание published-материала через staff-эндпоинты (тикет 01)."""
    created = client.post(
        "/api/v1/rag/documents",
        json={
            "title": "ГОСТ Р 58048-2017 — УГТ 5",
            "doc_type": "gost",
            "ugt_level": 5,
            "raw_text": RAG_TEXT,
            "source_uri": "gost/58048#ugt5",
            "source_type": "gov",
        },
        headers=_auth(admin_token),
    )
    assert created.status_code == 201, created.text
    doc = created.json()
    reviewed = client.post(
        f"/api/v1/rag/documents/{doc['id']}/review", headers=_auth(admin_token)
    )
    assert reviewed.status_code == 200, reviewed.text
    published = client.post(
        f"/api/v1/rag/documents/{doc['id']}/publish", headers=_auth(admin_token)
    )
    assert published.status_code == 200, published.text
    return doc


def _chat(
    client: TestClient, question: str, session_id: str = "s-test"
) -> tuple[int, dict]:
    response = client.post(
        "/api/v1/rag/chat", json={"question": question, "session_id": session_id}
    )
    return response.status_code, response.json()


# ─── Частотный лимит (окно N минут, по IP) ──────────────────────────────────


def test_frequency_limit_returns_429_with_retry_after(
    client: TestClient, fake_llm: FakeLLMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rag_rate_limit_per_window", 2)
    monkeypatch.setattr(settings, "rag_daily_request_limit", 100)
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    for _ in range(2):
        status_code, _ = _chat(client, MATCHING_QUERY)
        assert status_code == 200

    # 3-й запрос в окне → 429 (частота), честное сообщение + Retry-After.
    response = client.post(
        "/api/v1/rag/chat", json={"question": OTHER_QUERY, "session_id": "s-freq"}
    )
    assert response.status_code == 429, response.text
    assert response.json()["detail"] == RATE_LIMIT_MESSAGE
    retry_after = int(response.headers.get("retry-after", "0"))
    assert 0 < retry_after <= 15 * 60, response.headers


def test_daily_limit_returns_429(
    client: TestClient, fake_llm: FakeLLMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rag_daily_request_limit", 2)
    monkeypatch.setattr(settings, "rag_rate_limit_per_window", 100)
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    for _ in range(2):
        status_code, _ = _chat(client, MATCHING_QUERY)
        assert status_code == 200

    # 3-й запрос за сутки → 429 (суточный лимит; кеш не обходит лимиты).
    status_code, body = _chat(client, MATCHING_QUERY)
    assert status_code == 429
    assert body["detail"] == DAILY_LIMIT_MESSAGE


def test_session_id_change_does_not_reset_daily_limit(
    client: TestClient, fake_llm: FakeLLMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rag_daily_request_limit", 2)
    monkeypatch.setattr(settings, "rag_rate_limit_per_window", 100)
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    assert _chat(client, MATCHING_QUERY, session_id="s-a")[0] == 200
    # Смена session_id НЕ обнуляет суточный лимит (ключ — IP).
    assert _chat(client, OTHER_QUERY, session_id="s-b")[0] == 200
    status_code, body = _chat(client, MATCHING_QUERY, session_id="s-c")
    assert status_code == 429
    assert body["detail"] == DAILY_LIMIT_MESSAGE


# ─── Input limit (2000 символов) ─────────────────────────────────────────────


def test_input_over_2000_chars_returns_422(
    client: TestClient, fake_llm: FakeLLMClient
) -> None:
    response = client.post(
        "/api/v1/rag/chat", json={"question": "а" * 2001, "session_id": "s-long"}
    )
    assert response.status_code == 422, response.text


def test_input_exactly_2000_chars_is_accepted(
    client: TestClient, fake_llm: FakeLLMClient
) -> None:
    # Граница: 2000 символов — ещё валидный вопрос (не 422).
    response = client.post(
        "/api/v1/rag/chat", json={"question": "а" * 2000, "session_id": "s-bound"}
    )
    assert response.status_code == 200, response.text


# ─── Cost gate: дневной бюджет (запросы и токены) ───────────────────────────


def test_budget_requests_exceeded_returns_429(
    client: TestClient, fake_llm: FakeLLMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rag_daily_budget_requests", 1)
    monkeypatch.setattr(settings, "rag_daily_budget_tokens", 10**9)
    monkeypatch.setattr(settings, "rag_rate_limit_per_window", 100)
    monkeypatch.setattr(settings, "rag_daily_request_limit", 100)
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    status_code, _ = _chat(client, MATCHING_QUERY)
    assert status_code == 200

    # Свежий вопрос (не из кеша) → дневной бюджет исчерпан → 429.
    status_code, body = _chat(client, OTHER_QUERY)
    assert status_code == 429
    assert body["detail"] == BUDGET_MESSAGE
    assert RAG_METRICS["budget_blocked_total"] == 1


def test_budget_tokens_exceeded_returns_429(
    client: TestClient, fake_llm: FakeLLMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rag_daily_budget_requests", 10**6)
    monkeypatch.setattr(settings, "rag_daily_budget_tokens", 2)  # меньше одного ответа
    monkeypatch.setattr(settings, "rag_rate_limit_per_window", 100)
    monkeypatch.setattr(settings, "rag_daily_request_limit", 100)
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    status_code, _ = _chat(client, MATCHING_QUERY)
    assert status_code == 200

    status_code, body = _chat(client, OTHER_QUERY)
    assert status_code == 429
    assert body["detail"] == BUDGET_MESSAGE


def test_cached_answer_served_even_after_budget_exhausted(
    client: TestClient, fake_llm: FakeLLMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rag_daily_budget_requests", 1)
    monkeypatch.setattr(settings, "rag_daily_budget_tokens", 10**9)
    monkeypatch.setattr(settings, "rag_rate_limit_per_window", 100)
    monkeypatch.setattr(settings, "rag_daily_request_limit", 100)
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    status_code, body = _chat(client, MATCHING_QUERY)
    assert status_code == 200
    assert len(fake_llm.calls) == 1

    # Тот же вопрос — cache hit (200, LLM не вызывается, бюджет не тратится).
    status_code, _ = _chat(client, MATCHING_QUERY)
    assert status_code == 200
    assert len(fake_llm.calls) == 1
    assert RAG_METRICS["cache_hits_total"] == 1

    # Свежий вопрос после исчерпания бюджета → 429.
    status_code, body = _chat(client, OTHER_QUERY)
    assert status_code == 429
    assert body["detail"] == BUDGET_MESSAGE


# ─── Kill switch ─────────────────────────────────────────────────────────────


def test_kill_switch_returns_503_and_rest_api_works(
    client: TestClient, fake_llm: FakeLLMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    monkeypatch.setattr(settings, "rag_kill_switch", True)

    response = client.post(
        "/api/v1/rag/chat", json={"question": MATCHING_QUERY, "session_id": "s-kill"}
    )
    assert response.status_code == 503, response.text
    assert response.json()["detail"] == KILL_SWITCH_MESSAGE
    assert fake_llm.calls == [], "LLM не должен вызываться при kill switch"
    assert RAG_METRICS["kill_switch_total"] == 1

    # Остальной API работает (health — публичный).
    health = client.get("/api/v1/health")
    assert health.status_code == 200, health.text

    # После снятия флага консультант снова отвечает.
    monkeypatch.setattr(settings, "rag_kill_switch", False)
    status_code, body = _chat(client, MATCHING_QUERY)
    assert status_code == 200
    assert body["reply"] == fake_llm.reply


# ─── Кеш идентичных вопросов ────────────────────────────────────────────────


def test_identical_questions_served_from_cache_without_llm(
    client: TestClient, fake_llm: FakeLLMClient
) -> None:
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    status_code, first = _chat(client, MATCHING_QUERY)
    assert status_code == 200
    assert len(fake_llm.calls) == 1

    # Идентичный вопрос (другой session_id) — ответ из кеша, LLM не вызывается.
    status_code, second = _chat(client, MATCHING_QUERY, session_id="s-cache-2")
    assert status_code == 200
    assert second["reply"] == first["reply"]
    assert second["sources"] == first["sources"]
    assert len(fake_llm.calls) == 1, "cache hit не должен вызывать LLM"
    assert RAG_METRICS["cache_hits_total"] == 1

    # Другой вопрос — обычный путь (LLM вызывается повторно).
    status_code, _ = _chat(client, OTHER_QUERY)
    assert status_code == 200
    assert len(fake_llm.calls) == 2


# ─── Метрики/логи без PII ───────────────────────────────────────────────────


def test_metrics_and_logs_contain_no_question_texts(
    client: TestClient, fake_llm: FakeLLMClient, caplog: pytest.LogCaptureFixture
) -> None:
    marker_question = "УГТ 5 компоненты СУПЕРСЕКРЕТМАРКЕР777"
    marker_session = "секретная-сессия-424242"
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    with caplog.at_level(logging.INFO):
        status_code, _ = _chat(client, marker_question, session_id=marker_session)
        assert status_code == 200
        # Второй запрос с тем же текстом — cache hit (тоже событие лога).
        status_code, _ = _chat(client, marker_question, session_id=marker_session)
        assert status_code == 200

    log_text = caplog.text
    assert marker_question not in log_text, "текст вопроса не должен попадать в логи"
    assert marker_session not in log_text, "session_id не должен попадать в логи"
    assert "СУПЕРСЕКРЕТМАРКЕР777" not in log_text

    metrics = rag_metrics_snapshot()
    assert metrics["requests_total"] == 2
    assert metrics["cache_hits_total"] == 1
    assert metrics["llm_calls_total"] == 1
    assert metrics["input_tokens_total"] > 0
    assert metrics["output_tokens_total"] > 0
    # В метриках нет текстовых полей с вопросами (только числа).
    assert all(isinstance(v, int) for v in metrics.values())


def test_metrics_count_refusals_and_rate_limits(
    client: TestClient, fake_llm: FakeLLMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rag_rate_limit_per_window", 1)
    monkeypatch.setattr(settings, "rag_daily_request_limit", 100)
    admin_token = _register(client)
    _seed_doc(client, admin_token)

    assert _chat(client, MATCHING_QUERY)[0] == 200
    status_code, _ = _chat(client, OTHER_QUERY)
    assert status_code == 429

    metrics = rag_metrics_snapshot()
    assert metrics["requests_total"] == 2
    assert metrics["rate_limited_total"] == 1
    assert metrics["llm_calls_total"] == 1


# ─── Unit: оценка токенов и per-request потолок ─────────────────────────────


def test_estimate_tokens_heuristic() -> None:
    assert estimate_tokens("") == 1  # минимум 1 токен (никогда 0)
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("x" * 8) == 2
    assert estimate_tokens("x" * 40) == 10


def test_cap_output_tokens_enforces_per_request_max(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "rag_per_request_max_tokens", 2)  # 8 символов
    long_reply = "у" * 50
    capped = cap_output_tokens(long_reply)
    assert len(capped) <= 8
    assert capped.endswith("…")
    # Короткий ответ не меняется (≤ лимита токенов).
    short = "ок"
    assert cap_output_tokens(short) == short
