"""Таск 08 — AI-проводка через OpenAI-совместимый endpoint (G51–G56).

Швы — публичная HTTP-граница API (`POST /chat`, `POST /rag/search`) и
транспортный уровень `httpx` (мок, без живых вызовов); значений секретов
в тестах нет, только имена переменных и dummy-заглушки транспорта.
"""

from __future__ import annotations

import pytest


def test_ai_metric_increment_is_thread_safe() -> None:
    from concurrent.futures import ThreadPoolExecutor

    from app.services import ai_metrics

    before = ai_metrics.snapshot()["requests_total"]
    increments = 5000
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(ai_metrics.increment, ["requests_total"] * increments))

    assert ai_metrics.snapshot()["requests_total"] == before + increments


def test_sanitize_question_redacts_pii() -> None:
    """Обезличивание вопроса: email и телефон не уходят внешнему провайдеру."""
    from app.services.ai_wiring import sanitize_question_for_external

    redacted = sanitize_question_for_external(
        "Меня зовут Иван, почта ivan.petrov@example.com, "
        "телефон +7 916 123-45-67. Что говорит ГОСТ про УГТ 5?"
    )
    assert "ivan.petrov@example.com" not in redacted
    assert "916 123-45-67" not in redacted
    assert "+7 916" not in redacted
    assert "УГТ 5" in redacted


def _register(client, role: str = "gk_customer") -> str:
    import uuid

    from tests.support import register_test_user

    return register_test_user(
        client,
        email=f"wiring-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Wiring User",
        role_slug=role,
    )["access_token"]


def _mock_transport(monkeypatch, captured: dict, reply: str = "wired-ok") -> None:
    """Мок транспорта httpx: живого провайдера нет, исходящий JSON виден."""
    from unittest.mock import AsyncMock, MagicMock

    from app.services import ai_assistant

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"choices": [{"message": {"content": reply}}]}

    mock_client = AsyncMock()

    async def _capture_post(url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        captured["headers"] = kwargs.get("headers")
        return mock_response

    mock_client.post.side_effect = _capture_post
    mock_client_cls = MagicMock(return_value=mock_client)
    mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(ai_assistant.httpx, "AsyncClient", mock_client_cls)


def _gateway_on(monkeypatch, api_key: str = "sk-test-wiring-dummy"):
    """Включить контур провайдера с dummy-ключом; вернуть старые значения."""
    from app.services import ai_assistant

    old = (
        ai_assistant.settings.llm_gateway_enabled,
        ai_assistant.settings.llm_api_key,
        ai_assistant.settings.llm_api_base,
    )
    ai_assistant.settings.llm_gateway_enabled = True  # type: ignore[assignment]
    ai_assistant.settings.llm_api_key = api_key  # type: ignore[assignment]
    ai_assistant.settings.llm_api_base = "https://api.example.com/v1"  # type: ignore[assignment]
    return old


def _gateway_off(old) -> None:
    from app.services import ai_assistant

    ai_assistant.settings.llm_gateway_enabled = old[0]  # type: ignore[assignment]
    ai_assistant.settings.llm_api_key = old[1]  # type: ignore[assignment]
    ai_assistant.settings.llm_api_base = old[2]  # type: ignore[assignment]


def _mock_ai_client(
    monkeypatch, response: object = None, error: Exception | None = None
) -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.services import ai_assistant

    mock_client = AsyncMock()
    if error is not None:
        mock_client.post.side_effect = error
    else:
        mock_client.post.return_value = response
    mock_client_cls = MagicMock(return_value=mock_client)
    mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(ai_assistant.httpx, "AsyncClient", mock_client_cls)


@pytest.mark.asyncio
async def test_malformed_200_returns_none_and_increments_metric(monkeypatch) -> None:
    from unittest.mock import MagicMock

    from app.services import ai_assistant, ai_metrics

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"choices": []}

    _mock_ai_client(monkeypatch, mock_response)

    old = _gateway_on(monkeypatch)
    before = ai_metrics.snapshot()
    try:
        result = await ai_assistant.ask_llm("system", "hello")
        after = ai_metrics.snapshot()
        assert result is None
        assert after["errors_total"] == before["errors_total"] + 1
        assert after.get("malformed_total") == before.get("malformed_total", 0) + 1
    finally:
        _gateway_off(old)


@pytest.mark.parametrize(
    "payload",
    [
        None,
        {},
        {"choices": []},
        {"choices": "wrong"},
        {"choices": [None]},
        {"choices": [{}]},
        {"choices": [{"message": None}]},
        {"choices": [{"message": {}}]},
        {"choices": [{"message": {"content": ""}}]},
        {"choices": [{"message": {"content": "   "}}]},
        {"choices": [{"message": {"content": 42}}]},
    ],
)
@pytest.mark.asyncio
async def test_malformed_200_envelopes_return_none_and_count(monkeypatch, payload) -> None:
    from unittest.mock import MagicMock

    from app.services import ai_assistant, ai_metrics

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = payload

    _mock_ai_client(monkeypatch, mock_response)

    old = _gateway_on(monkeypatch)
    before = ai_metrics.snapshot()
    try:
        result = await ai_assistant.ask_llm("system", "hello")
        after = ai_metrics.snapshot()
        assert result is None
        assert after["errors_total"] == before["errors_total"] + 1
        assert after["malformed_total"] == before["malformed_total"] + 1
    finally:
        _gateway_off(old)


@pytest.mark.asyncio
async def test_non_json_200_returns_none_and_counts_malformed(monkeypatch) -> None:
    from unittest.mock import MagicMock

    from app.services import ai_assistant, ai_metrics

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.side_effect = ValueError("not json")

    _mock_ai_client(monkeypatch, mock_response)

    old = _gateway_on(monkeypatch)
    before = ai_metrics.snapshot()
    try:
        result = await ai_assistant.ask_llm("system", "hello")
        after = ai_metrics.snapshot()
        assert result is None
        assert after["errors_total"] == before["errors_total"] + 1
        assert after["malformed_total"] == before["malformed_total"] + 1
    finally:
        _gateway_off(old)


@pytest.mark.parametrize("status_code", [400, 401, 429, 500])
@pytest.mark.asyncio
async def test_http_failure_keeps_error_category(monkeypatch, status_code) -> None:
    from unittest.mock import MagicMock

    from app.services import ai_assistant, ai_metrics

    mock_response = MagicMock()
    mock_response.status_code = status_code

    _mock_ai_client(monkeypatch, mock_response)

    old = _gateway_on(monkeypatch)
    before = ai_metrics.snapshot()
    try:
        result = await ai_assistant.ask_llm("system", "hello")
        after = ai_metrics.snapshot()
        assert result is None
        assert after["errors_total"] == before["errors_total"] + 1
        assert after["malformed_total"] == before["malformed_total"]
        assert after["timeouts_total"] == before["timeouts_total"]
        mock_response.json.assert_not_called()
    finally:
        _gateway_off(old)


@pytest.mark.asyncio
async def test_timeout_keeps_timeout_category(monkeypatch) -> None:
    import httpx

    from app.services import ai_assistant, ai_metrics

    _mock_ai_client(monkeypatch, error=httpx.ReadTimeout("timed out"))

    old = _gateway_on(monkeypatch)
    before = ai_metrics.snapshot()
    try:
        result = await ai_assistant.ask_llm("system", "hello")
        after = ai_metrics.snapshot()
        assert result is None
        assert after["errors_total"] == before["errors_total"]
        assert after["malformed_total"] == before["malformed_total"]
        assert after["timeouts_total"] == before["timeouts_total"] + 1
    finally:
        _gateway_off(old)


def test_chat_external_prompt_has_no_pii(client, monkeypatch) -> None:
    """G56 через шов POST /chat: email/телефон не уходят по HTTP наружу."""
    captured: dict = {}
    _mock_transport(monkeypatch, captured)
    old = _gateway_on(monkeypatch)
    try:
        token = _register(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "message": "Почта ivan.petrov@example.com, тел +7 916 123-45-67. "
                "Что говорит ГОСТ про УГТ 5?"
            },
        )
        assert response.status_code == 200, response.text
        assert response.json()["reply"]["content"] == "wired-ok"
        sent = captured["json"]["messages"][1]["content"]
        assert "ivan.petrov@example.com" not in sent
        assert "916" not in sent
        assert "УГТ 5" in sent
    finally:
        _gateway_off(old)


def _seed_template(client, admin_token: str, title: str, text: str) -> None:
    response = client.post(
        "/api/v1/rag/templates",
        json={"title": title, "doc_type": "gost", "raw_text": text},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201, response.text


def test_non_allowlist_fragment_never_goes_external(client, monkeypatch) -> None:
    """G56/G58 через шов POST /chat: внутренний документ не уходит наружу,
    но честно остаётся в локальных источниках ответа."""
    admin_token = _register(client, "cntr_admin")
    _seed_template(
        client,
        admin_token,
        "интервью ЦНТР.pdf",
        "СЕКРЕТ-ИНТЕРВЬЮ-МАРКЕР invoicing внутренний отчёт проекта",
    )
    _seed_template(
        client,
        admin_token,
        "ГОСТ Р 58048-2017.pdf",
        "ГОСТ-МАРКЕР уровни готовности технологии invoicing",
    )

    captured: dict = {}
    _mock_transport(monkeypatch, captured)
    old = _gateway_on(monkeypatch)
    try:
        token = _register(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Расскажи про invoicing и уровни готовности"},
        )
        assert response.status_code == 200, response.text
        titles = [s["title"] for s in response.json()["sources"]]
        # Оба документа найдены и процитированы локально...
        assert "интервью ЦНТР.pdf" in titles
        assert "ГОСТ Р 58048-2017.pdf" in titles
        # ...но наружу ушёл только allowlist-фрагмент.
        sent = captured["json"]["messages"][1]["content"]
        assert "ГОСТ-МАРКЕР" in sent
        assert "СЕКРЕТ-ИНТЕРВЬЮ-МАРКЕР" not in sent
    finally:
        _gateway_off(old)


def test_suffixless_fragment_never_goes_external() -> None:
    """№53/deny-by-default: фрагмент без файлового имени тоже идёт через гейт."""
    from app.services.ai_wiring import select_external_fragments

    selected = select_external_fragments(
        [
            ("методология", "СЕКРЕТ-БЕЗ-СУФФИКСА внутренний шаблон"),
            ("ГОСТ Р 58048-2017.pdf", "ГОСТ-МАРКЕР уровни готовности"),
        ]
    )
    names = [name for name, _ in selected]
    assert "методология" not in names
    assert "ГОСТ Р 58048-2017.pdf" in names


def test_opencode_key_env_maps_to_llm_settings(monkeypatch) -> None:
    """G52/G55: значение ключа — только из окружения (`OPENCODE_API_KEY`).

    Серверная настройка пуста — вызов всё равно идёт с ключом из
    окружения; без него внешнего вызова нет."""
    import asyncio

    from app.services import ai_assistant
    from app.services.ai_wiring import OPENCODE_API_KEY_ENV, resolve_llm_api_key

    old_gateway = ai_assistant.settings.llm_gateway_enabled
    old_key = ai_assistant.settings.llm_api_key
    ai_assistant.settings.llm_gateway_enabled = True  # type: ignore[assignment]
    ai_assistant.settings.llm_api_key = None  # type: ignore[assignment]
    monkeypatch.delenv(OPENCODE_API_KEY_ENV, raising=False)
    try:
        assert resolve_llm_api_key() is None

        monkeypatch.setenv(OPENCODE_API_KEY_ENV, "sk-test-opencode-dummy")
        assert resolve_llm_api_key() == "sk-test-opencode-dummy"

        captured: dict = {}
        _mock_transport(monkeypatch, captured)
        result = asyncio.run(ai_assistant.ask_llm("system", "hello"))
        assert result == "wired-ok"
        assert captured["headers"]["Authorization"] == "Bearer sk-test-opencode-dummy"
    finally:
        ai_assistant.settings.llm_gateway_enabled = old_gateway  # type: ignore[assignment]
        ai_assistant.settings.llm_api_key = old_key  # type: ignore[assignment]


def test_provider_down_gives_honest_fallback(client, monkeypatch) -> None:
    """Даун провайдера: честный локальный ответ по корпусу, а не выдумка."""
    import httpx

    admin_token = _register(client, "cntr_admin")
    _seed_template(
        client,
        admin_token,
        "ГОСТ Р 58048-2017.pdf",
        "ГОСТ-ФОЛБЭК-МАРКЕР уровни готовности технологии",
    )

    async def _down_post(self, *args, **kwargs):  # noqa: ARG001
        raise httpx.ConnectError("provider down")

    monkeypatch.setattr(httpx.AsyncClient, "post", _down_post)
    old = _gateway_on(monkeypatch)
    try:
        token = _register(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Расскажи про уровни готовности"},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        # Честная метка локального ответа + заземление на корпус, не выдумка.
        assert "Нашёл в базе знаний" in data["reply"]["content"]
        assert "ГОСТ-ФОЛБЭК-МАРКЕР" in data["reply"]["content"]
        assert len(data["sources"]) >= 1
    finally:
        _gateway_off(old)


def test_malformed_200_uses_honest_fallback(client, monkeypatch) -> None:
    from unittest.mock import MagicMock

    from app.services import ai_metrics

    admin_token = _register(client, "cntr_admin")
    _seed_template(
        client,
        admin_token,
        "ГОСТ Р 58048-2017.pdf",
        "ГОСТ-МАЛФОРМЕД-ФОЛБЭК уровни готовности технологии",
    )

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"choices": []}
    _mock_ai_client(monkeypatch, mock_response)

    old = _gateway_on(monkeypatch)
    before = ai_metrics.snapshot()
    try:
        token = _register(client)
        response = client.post(
            "/api/v1/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Расскажи про уровни готовности"},
        )
        after = ai_metrics.snapshot()
        assert response.status_code == 200, response.text
        data = response.json()
        assert "Нашёл в базе знаний" in data["reply"]["content"]
        assert "ГОСТ-МАЛФОРМЕД-ФОЛБЭК" in data["reply"]["content"]
        assert after["errors_total"] == before["errors_total"] + 1
        assert after["malformed_total"] == before["malformed_total"] + 1
        assert after["fallbacks_total"] == before["fallbacks_total"] + 1
    finally:
        _gateway_off(old)


def test_chat_and_search_answer_with_sources(client, monkeypatch) -> None:
    """G53/G54: чат и RAG-поиск отвечают по корпусу с указанием источников."""
    from app.services import ai_assistant

    async def _fake_llm(system: str, user_msg: str, session_id: str | None = None) -> str:  # noqa: ARG001
        return "Ответ по корпусу ГОСТов."

    monkeypatch.setattr(ai_assistant, "ask_llm", _fake_llm)
    admin_token = _register(client, "cntr_admin")
    _seed_template(
        client,
        admin_token,
        "ГОСТ Р 58048-2017.pdf",
        "ГОСТ-ЦИТАТА-МАРКЕР критерии уровней готовности",
    )

    token = _register(client)
    chat = client.post(
        "/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Какие критерии уровней готовности?"},
    )
    assert chat.status_code == 200, chat.text
    assert chat.json()["reply"]["content"] == "Ответ по корпусу ГОСТов."
    assert any(
        s["title"] == "ГОСТ Р 58048-2017.pdf" for s in chat.json()["sources"]
    )

    search = client.post(
        "/api/v1/rag/search",
        headers={"Authorization": f"Bearer {token}"},
        json={"query": "критерии уровней готовности", "top_k": 3},
    )
    assert search.status_code == 200, search.text
    assert any(
        r["document"]["title"] == "ГОСТ Р 58048-2017.pdf"
        and isinstance(r["similarity"], float)
        for r in search.json()
    )


def test_wiring_modules_secret_scan_is_clean() -> None:
    """G52: значений секретов нет в коде проводки — только имена переменных."""
    import re
    from pathlib import Path

    secret_assign = re.compile(
        r"""(?i)(api[_-]?key|apikey|secret|password|passwd|token)\s*=\s*["'][^"']{12,}["']"""
    )
    root = Path(__file__).resolve().parent.parent / "app" / "services"
    for name in ("ai_wiring.py", "ai_assistant.py"):
        source = (root / name).read_text(encoding="utf-8")
        hits = [line for line in source.splitlines() if secret_assign.search(line)]
        assert hits == [], (name, hits)


def test_zen_alias_key_env_resolves(monkeypatch) -> None:
    """Алиас OPENCODE_ZEN_API_KEY — тот же ключ Go под другим именем."""
    from app.services import ai_assistant
    from app.services.ai_wiring import (
        OPENCODE_API_KEY_ENV,
        OPENCODE_ZEN_API_KEY_ENV,
        resolve_llm_api_key,
    )

    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", None)
    monkeypatch.delenv(OPENCODE_API_KEY_ENV, raising=False)
    monkeypatch.delenv(OPENCODE_ZEN_API_KEY_ENV, raising=False)
    assert resolve_llm_api_key() is None

    monkeypatch.setenv(OPENCODE_ZEN_API_KEY_ENV, "sk-test-zen-alias-dummy")
    assert resolve_llm_api_key() == "sk-test-zen-alias-dummy"

    # Приоритет: OPENCODE_API_KEY старше алиаса, настройка старше обоих.
    monkeypatch.setenv(OPENCODE_API_KEY_ENV, "sk-test-opencode-dummy")
    assert resolve_llm_api_key() == "sk-test-opencode-dummy"
    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", "sk-test-settings-dummy")
    assert resolve_llm_api_key() == "sk-test-settings-dummy"


def test_go_headers_session_and_user_agent(monkeypatch) -> None:
    """OpenCode Go: свой User-Agent и x-opencode-session в каждом запросе."""
    import asyncio

    from app.services import ai_assistant

    captured: dict = {}
    _mock_transport(monkeypatch, captured)
    old = _gateway_on(monkeypatch)
    try:
        result = asyncio.run(
            ai_assistant.ask_llm("system", "hello", session_id="sess-123")
        )
        assert result == "wired-ok"
        headers = captured["headers"]
        assert headers["User-Agent"] == ai_assistant.LLM_USER_AGENT
        assert "httpx" not in headers["User-Agent"]
        assert headers[ai_assistant.OPENCODE_SESSION_HEADER] == "sess-123"

        # Без явной сессии — сгенерированный id, но заголовок обязан быть.
        result = asyncio.run(ai_assistant.ask_llm("system", "hello"))
        assert result == "wired-ok"
        auto = captured["headers"][ai_assistant.OPENCODE_SESSION_HEADER]
        assert isinstance(auto, str) and len(auto) >= 16
    finally:
        _gateway_off(old)


def test_stable_session_id_is_opaque_and_stable() -> None:
    """stable_session_id: детерминирован, наружу — только хеш без id/PII."""
    from app.services.ai_assistant import stable_session_id

    first = stable_session_id("chat", 12345)
    assert first == stable_session_id("chat", 12345)
    assert first != stable_session_id("chat", 12346)
    assert first != stable_session_id("stage", 12345)
    assert "12345" not in first
    assert len(first) == 32
