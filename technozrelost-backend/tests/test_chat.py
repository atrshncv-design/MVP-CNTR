"""AI-ассистент: OpenAI-совместимый клиент, fallback, источники из RAG."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.services import ai_assistant
from tests.support import register_test_user


def _register(client: TestClient, role: str = "rd_executor") -> str:
    email = f"chat-{uuid.uuid4().hex[:8]}@example.com"
    return register_test_user(
        client,
        email=email,
        full_name="Chat User",
        role_slug=role,
    )["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_rag_doc(client: TestClient, admin_token: str) -> None:
    """Загрузка шаблона + прохождение editorial workflow (review -> publish).

    С тикета 01 ai-rag в retrieval попадают только published-материалы,
    поэтому сид-документ проходит review и публикацию.
    """
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
    doc_id = response.json()["id"]

    reviewed = client.post(
        f"/api/v1/rag/documents/{doc_id}/review", headers=_auth(admin_token)
    )
    assert reviewed.status_code == 200, reviewed.text
    published = client.post(
        f"/api/v1/rag/documents/{doc_id}/publish", headers=_auth(admin_token)
    )
    assert published.status_code == 200, published.text


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


def test_llm_config_returns_none_without_key(monkeypatch) -> None:
    """Без LLM_API_KEY (пусто/change_me) ask_llm уходит в fallback (тикет 08)."""
    from app.core.config import settings
    from app.services.ai_assistant import _llm_config

    monkeypatch.setattr(settings, "llm_api_key", "")
    key, base, model = _llm_config()
    assert key is None
    assert base.endswith("/v1")

    monkeypatch.setattr(settings, "llm_api_key", "change_me")
    key, _, _ = _llm_config()
    assert key is None

    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    key, _, _ = _llm_config()
    assert key == "test-key"
    assert model == settings.llm_model


def test_ask_llm_builds_openai_compatible_request(monkeypatch) -> None:
    """Test-double клиент: запрос к {base}/chat/completions с Bearer-ключом.

    Проверяет форму OpenAI-совместимого вызова (тикет 08) без live-LLM.
    """
    import asyncio

    import httpx

    from app.services import ai_assistant as module

    captured: dict = {}

    class FakeResponse:
        status_code = 200

        def json(self) -> dict:
            return {"choices": [{"message": {"content": "Ответ тестового LLM"}}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):  # noqa: ARG002
            captured["timeout"] = kwargs.get("timeout")

        async def __aenter__(self) -> FakeAsyncClient:
            return self

        async def __aexit__(self, *exc) -> bool:  # noqa: ARG002
            return False

        async def post(self, url, json=None, headers=None):  # noqa: A002
            captured["url"] = url
            captured["json"] = json
            captured["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr(
        module, "_llm_config", lambda: ("test-key", "https://llm.example/v1", "test-model")
    )
    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    result = asyncio.run(module.ask_llm("system-промпт", "вопрос"))
    assert result == "Ответ тестового LLM"
    assert captured["url"] == "https://llm.example/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["json"]["model"] == "test-model"
    assert captured["json"]["messages"][0] == {"role": "system", "content": "system-промпт"}
    assert captured["json"]["messages"][1] == {"role": "user", "content": "вопрос"}
