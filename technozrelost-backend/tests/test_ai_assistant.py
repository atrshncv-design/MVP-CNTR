"""Тикет 14 Friday RC: отказоустойчивый AI-консультант.

Покрытие:
- Ответы содержат ссылки на источники (RAG)
- AI не меняет проект/УГТ/требования (chat read-only)
- Ошибка провайдера не ломает платформу (fallback-ответ)
- Лимиты запросов (429) и отдельные метрики
- Основные тесты используют стаб, живой провайдер — только smoke
"""

from __future__ import annotations

import uuid
from contextlib import contextmanager

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("t14"), full_name="Тикет14", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


@contextmanager
def _stub_llm(reply: str | None):
    """Стаб провайдера: live-LLM в основных тестах не вызывается."""
    from app.services import ai_assistant as module

    async def fake(*args, **kwargs):  # noqa: ARG001
        return reply

    original = module.ask_llm
    module.ask_llm = fake  # type: ignore[assignment]
    try:
        yield
    finally:
        module.ask_llm = original


def test_chat_returns_sources_and_reply(client: TestClient) -> None:
    """Ответ содержит reply и список источников (RAG)."""
    token, _ = _register(client)
    with _stub_llm("Ответ по методологии ГОСТ Р 58048-2017."):
        response = client.post(
            "/api/v1/chat",
            headers=_auth(token),
            json={"message": "Что такое УГТ?"},
        )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["reply"]["role"] == "assistant"
    assert isinstance(data["reply"]["content"], str)
    assert isinstance(data["sources"], list)


def test_llm_failure_falls_back_without_crash(client: TestClient) -> None:
    """Ошибка провайдера не ломает платформу: fallback-ответ 200."""
    token, _ = _register(client)
    with _stub_llm(None):  # провайдер вернул None (ошибка/таймаут)
        response = client.post(
            "/api/v1/chat",
            headers=_auth(token),
            json={"message": "Критерии УГТ 3"},
        )
    assert response.status_code == 200, response.text
    assert "assistant" in response.json()["reply"]["role"]


def test_chat_does_not_mutate_project(client: TestClient) -> None:
    """AI-запрос не меняет проект, УГТ или требования (read-only)."""
    token, _ = _register(client)
    created = client.post(
        "/api/v1/projects",
        headers=_auth(token),
        json={"name": "Не трогать", "questionnaire_results": []},
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    with _stub_llm("Консультация не меняет данные."):
        response = client.post(
            "/api/v1/chat",
            headers=_auth(token),
            json={"message": "Стоит ли повысить УГТ?"},
        )
    assert response.status_code == 200

    after = client.get(f"/api/v1/projects/{pid}", headers=_auth(token))
    assert after.status_code == 200
    assert after.json()["project"]["status"] == "draft"
    assert after.json()["project"]["current_level"] == 0


def test_ai_metrics_endpoint(client: TestClient) -> None:
    """Отдельные метрики AI-консультанта доступны."""
    token, _ = _register(client)
    with _stub_llm("ok"):
        client.post(
            "/api/v1/chat", headers=_auth(token), json={"message": "Привет"}
        )
    metrics = client.get("/api/v1/chat/metrics/ai", headers=_auth(token))
    assert metrics.status_code == 200, metrics.text
    data = metrics.json()
    assert data["requests_total"] >= 1
    assert "requests_by_user" not in data
    assert "fallbacks_total" in data


def test_chat_rate_limit(client: TestClient) -> None:
    """Лимит запросов: превышение окна → 429."""
    token, _ = _register(client)
    from app.services import ai_metrics

    # сбрасываем окно и ставим лимит 2
    ai_metrics._user_window.clear()  # noqa: SLF001
    ai_metrics.RATE_LIMIT["limit"] = 2

    try:
        with _stub_llm("ok"):
            first = client.post(
                "/api/v1/chat", headers=_auth(token), json={"message": "1"}
            )
            second = client.post(
                "/api/v1/chat", headers=_auth(token), json={"message": "2"}
            )
            third = client.post(
                "/api/v1/chat", headers=_auth(token), json={"message": "3"}
            )
        assert first.status_code == 200
        assert second.status_code == 200
        assert third.status_code == 429
    finally:
        ai_metrics.RATE_LIMIT["limit"] = 30
        ai_metrics._user_window.clear()  # noqa: SLF001
