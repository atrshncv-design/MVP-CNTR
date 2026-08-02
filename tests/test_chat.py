"""AI-ассистент: OpenAI-совместимый клиент, fallback, источники из RAG."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.services import ai_assistant


def _register(client: TestClient, role: str = "rd_executor") -> str:
    email = f"chat-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": "Chat User",
            "role_slug": role,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_rag_doc(client: TestClient, admin_token: str) -> None:
    response = client.post(
        "/api/v1/rag/templates",
        json={
            "title": "ГОСТ Р 58048-2017 — УГТ 5",
            "doc_type": "gost",
            "ugt_level": 5,
            "raw_text": (
                "УГТ 5: компоненты технологии интегрированы и испытаны "
                "в условиях, близких к реальным."
            ),
            "source_uri": "gost/58048#ugt5",
        },
        headers=_auth(admin_token),
    )
    assert response.status_code == 201, response.text


def test_chat_requires_auth(client: TestClient) -> None:
    response = client.post("/api/v1/chat", json={"message": "Привет"})
    assert response.status_code == 401


def test_chat_fallback_without_rag_docs(client: TestClient) -> None:
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        json={"message": "Что такое УГТ?"},
        headers=_auth(token),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["reply"]["role"] == "assistant"
    assert "ничего не найдено" in data["reply"]["content"]
    assert data["sources"] == []


def test_chat_fallback_shows_rag_sources(client: TestClient) -> None:
    admin_token = _register(client, "cntr_admin")
    _seed_rag_doc(client, admin_token)

    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        json={"message": "УГТ 5 компоненты"},
        headers=_auth(token),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "Нашёл в базе знаний" in data["reply"]["content"]
    assert len(data["sources"]) >= 1
    assert data["sources"][0]["doc_type"] == "gost"


def test_chat_uses_llm_when_available(client: TestClient, monkeypatch) -> None:
    async def fake_ask_llm(system_prompt: str, user_message: str) -> str:
        return "Ответ от LLM: УГТ 5 — это прототип в реальных условиях."

    monkeypatch.setattr(ai_assistant, "ask_llm", fake_ask_llm)

    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        json={"message": "Что такое УГТ 5?"},
        headers=_auth(token),
    )
    assert response.status_code == 200
    assert response.json()["reply"]["content"].startswith("Ответ от LLM")


def test_chat_rag_search_runs_once(client: TestClient, monkeypatch) -> None:
    """RAG-поиск выполняется один раз на запрос (без дублирования)."""
    from app.services import rag as rag_module

    calls = {"n": 0}

    original = rag_module.search_documents

    async def counting_search(*args, **kwargs):
        calls["n"] += 1
        return await original(*args, **kwargs)

    monkeypatch.setattr(rag_module, "search_documents", counting_search)
    # ai_assistant импортирует search_documents из rag — патчим и там
    monkeypatch.setattr(ai_assistant, "search_documents", counting_search)

    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        json={"message": "тест"},
        headers=_auth(token),
    )
    assert response.status_code == 200
    assert calls["n"] == 1, f"RAG-поиск выполнился {calls['n']} раз вместо 1"
