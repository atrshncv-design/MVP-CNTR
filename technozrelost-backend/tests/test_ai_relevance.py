"""Порог релевантности RAG: мусор вместо «ничего не найдено» (прод 2026-09-21).

Диагноз: запрос без единого общего терма с корпусом («Ты работаешь?»,
скор combined ~0.0) возвращал первые попавшиеся документы — сортировка
без порога всегда отдаёт top_k. Плюс местоимение «ты» давало
ILIKE-префильтр %ты% по всему корпусу.

Швы — публичная HTTP-граница: POST /chat, POST /rag/search.
Живого провайдера нет: даун — через ConnectError/статус, ключи — dummy.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user

SEED_TITLE = "ГОСТ Р 58048-2017.pdf"
SEED_TEXT = (
    "Уровни готовности технологии УГТ критерии оценки шкала готовности "
    "производства РЕЛЕВАНТМАРКЕР разделы стандарта"
)
GREETING_QUERY = "Ты работаешь?"
GENUINE_QUERY = "Критерии оценки УГТ"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> str:
    return register_test_user(
        client,
        email=_email("relevance"),
        full_name="Relevance User",
        role_slug=role,
    )["access_token"]


def _seed_gost(client: TestClient) -> None:
    admin_token = _register(client, "cntr_admin")
    response = client.post(
        "/api/v1/rag/templates",
        json={"title": SEED_TITLE, "doc_type": "gost", "raw_text": SEED_TEXT},
        headers=_auth(admin_token),
    )
    assert response.status_code == 201, response.text


def _gateway_off(monkeypatch) -> None:
    from app.services import ai_assistant
    from app.services.ai_wiring import OPENCODE_API_KEY_ENV

    monkeypatch.setattr(ai_assistant.settings, "llm_gateway_enabled", False)
    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", None)
    monkeypatch.delenv(OPENCODE_API_KEY_ENV, raising=False)


def _gateway_on_key(monkeypatch, key: str = "sk-test-relevance-dummy") -> None:
    from app.services import ai_assistant
    from app.services.ai_wiring import OPENCODE_API_KEY_ENV

    monkeypatch.setattr(ai_assistant.settings, "llm_gateway_enabled", True)
    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", key)
    monkeypatch.delenv(OPENCODE_API_KEY_ENV, raising=False)


def test_greeting_without_overlap_returns_honest_no_docs(
    client: TestClient, monkeypatch
) -> None:
    """«Ты работаешь?» при полном корпусе: честное «ничего не найдено», не мусор."""
    _gateway_off(monkeypatch)
    _seed_gost(client)
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers=_auth(token),
        json={"message": GREETING_QUERY},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "ничего не найдено" in data["reply"]["content"]
    assert data["sources"] == []


def test_greeting_with_llm_down_returns_honest_no_docs(
    client: TestClient, monkeypatch
) -> None:
    """Тот же запрос при дауне провайдера: «ничего не найдено», 200, без выдержек."""
    import httpx

    async def _down_post(self, *args, **kwargs):  # noqa: ARG001
        raise httpx.ConnectError("provider down")

    monkeypatch.setattr(httpx.AsyncClient, "post", _down_post)
    _gateway_on_key(monkeypatch)
    _seed_gost(client)
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers=_auth(token),
        json={"message": GREETING_QUERY},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "ничего не найдено" in data["reply"]["content"]
    assert data["sources"] == []


def test_genuine_query_still_returns_excerpts(
    client: TestClient, monkeypatch
) -> None:
    """Порог не съедает живые запросы: «Критерии оценки УГТ» — выдержки есть."""
    _gateway_off(monkeypatch)
    _seed_gost(client)
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers=_auth(token),
        json={"message": GENUINE_QUERY},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "Нашёл в базе знаний" in data["reply"]["content"]
    assert "РЕЛЕВАНТМАРКЕР" in data["reply"]["content"]
    assert len(data["sources"]) >= 1


def test_rag_search_filters_zero_overlap(client: TestClient) -> None:
    """POST /rag/search на запрос без пересечения: пустой список, 200."""
    _seed_gost(client)
    token = _register(client)
    response = client.post(
        "/api/v1/rag/search",
        headers=_auth(token),
        json={"query": GREETING_QUERY, "top_k": 3},
    )
    assert response.status_code == 200, response.text
    assert response.json() == []


def test_pronouns_are_stopwords() -> None:
    """Местоимения — шум: «ты/я/он/она/оно» не участвуют в поиске."""
    from app.core.embeddings import tokenize

    assert tokenize("Ты работаешь?") == ["работаешь"]
    assert tokenize("я он она оно") == []


def test_llm_non200_logged_without_secrets(
    client: TestClient, monkeypatch, caplog
) -> None:
    """Отказ провайдера (403 как на проде) виден в логах, секретов там нет."""
    from unittest.mock import AsyncMock, MagicMock

    from app.services import ai_assistant

    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client_cls = MagicMock(return_value=mock_client)
    mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(ai_assistant.httpx, "AsyncClient", mock_client_cls)
    _gateway_on_key(monkeypatch, key="sk-test-secret-dummy")

    _seed_gost(client)
    token = _register(client)
    with caplog.at_level("WARNING", logger="app.services.ai_assistant"):
        response = client.post(
            "/api/v1/chat",
            headers=_auth(token),
            json={"message": GENUINE_QUERY},
        )
    assert response.status_code == 200, response.text
    logged = "\n".join(record.getMessage() for record in caplog.records)
    assert "403" in logged
    assert "sk-test-secret-dummy" not in logged


UGT_SECTION_TITLE = "ГОСТ Р 58048-2017 оценка зрелости — раздел 4"
# В тексте намеренно НЕТ аббревиатуры «УГТ» — только «уровень зрелости»
# и «готовности», как в реальных разделах корпуса.
UGT_SECTION_TEXT = (
    "Методические указания по оценке уровня зрелости технологий. "
    "Шкала готовности производства УГТМАРКЕР критерии перехода разделы."
)
UGT_QUERY = "расскажи про угт 6"


def _seed_ugt_section(client: TestClient) -> None:
    admin_token = _register(client, "cntr_admin")
    response = client.post(
        "/api/v1/rag/templates",
        json={
            "title": UGT_SECTION_TITLE,
            "doc_type": "gost",
            "raw_text": UGT_SECTION_TEXT,
        },
        headers=_auth(admin_token),
    )
    assert response.status_code == 201, response.text


def test_ugt_canon_links_abbreviation_and_spelled_out() -> None:
    """Канон syn_ugt: «угт» и «уровень зрелости/готовности» — один терм."""
    from app.core.embeddings import expanded_terms, token_to_canonical

    assert token_to_canonical("угт") == "syn_ugt"
    assert "syn_ugt" in expanded_terms("оценка уровня зрелости")
    assert "syn_ugt" in expanded_terms("шкала готовности производства")


def test_ugt_abbreviation_finds_spelled_out_sections(client: TestClient) -> None:
    """«расскажи про угт 6» находит разделы 58048 без аббревиатуры в тексте."""
    _seed_ugt_section(client)
    token = _register(client)
    response = client.post(
        "/api/v1/rag/search",
        headers=_auth(token),
        json={"query": UGT_QUERY, "top_k": 3},
    )
    assert response.status_code == 200, response.text
    results = response.json()
    assert results, "синоним УГТ не сработал — раздел потерян"
    assert results[0]["document"]["title"] == UGT_SECTION_TITLE


def test_ugt_query_returns_excerpts_not_empty(client: TestClient, monkeypatch) -> None:
    """Тот же запрос в /chat: выдержки из 58048, а не «ничего не найдено»."""
    _gateway_off(monkeypatch)
    _seed_ugt_section(client)
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers=_auth(token),
        json={"message": UGT_QUERY},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "УГТМАРКЕР" in data["reply"]["content"]
    assert len(data["sources"]) >= 1


def test_llm_max_tokens_cap_is_sent(monkeypatch) -> None:
    """Cap генерации едет в провайдер: не больше 1500 (хвосты reasoning)."""
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    from app.services import ai_assistant

    captured: dict = {}
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"choices": [{"message": {"content": "ok"}}]}
    mock_client = AsyncMock()

    async def _capture_post(url, **kwargs):
        captured["json"] = kwargs.get("json")
        return mock_response

    mock_client.post.side_effect = _capture_post
    mock_client_cls = MagicMock(return_value=mock_client)
    mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(ai_assistant.httpx, "AsyncClient", mock_client_cls)

    old_gateway = ai_assistant.settings.llm_gateway_enabled
    old_key = ai_assistant.settings.llm_api_key
    ai_assistant.settings.llm_gateway_enabled = True  # type: ignore[assignment]
    ai_assistant.settings.llm_api_key = "sk-test-captoken-dummy"  # type: ignore[assignment]
    try:
        result = asyncio.run(ai_assistant.ask_llm("s", "hi"))
    finally:
        ai_assistant.settings.llm_gateway_enabled = old_gateway  # type: ignore[assignment]
        ai_assistant.settings.llm_api_key = old_key  # type: ignore[assignment]
    assert result == "ok"
    assert ai_assistant.LLM_MAX_TOKENS <= 1500
    assert captured["json"]["max_tokens"] == ai_assistant.LLM_MAX_TOKENS
