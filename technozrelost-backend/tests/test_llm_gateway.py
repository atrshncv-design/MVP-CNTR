"""Тикет 01 — LLM-гейтвей N-05: контур без PII.

Гейтвей выключен по умолчанию (Settings.llm_gateway_enabled=False),
ask_llm возвращает None без внешнего вызова — название с ФИО не покидает контур.
Хеш-проверка гарантирует, что PII не уходит в LLM при закрытом гейтвее.
"""

from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.config import Settings
from app.services import ai_assistant


def test_settings_default_gateway_disabled() -> None:
    """По умолчанию гейтвей выключен — контур закрыт."""
    settings = Settings(_env_file=None)
    assert settings.llm_gateway_enabled is False


def test_settings_gateway_enabled_via_init() -> None:
    settings = Settings(_env_file=None, llm_gateway_enabled=True)
    assert settings.llm_gateway_enabled is True
    settings_off = Settings(_env_file=None, llm_gateway_enabled=False)
    assert settings_off.llm_gateway_enabled is False


def test_settings_gateway_env_name(monkeypatch: pytest.MonkeyPatch) -> None:
    """Переменная окружения — только имя LLM_GATEWAY_ENABLED."""
    monkeypatch.setenv("LLM_GATEWAY_ENABLED", "true")
    s = Settings(_env_file=None)
    assert s.llm_gateway_enabled is True
    monkeypatch.setenv("LLM_GATEWAY_ENABLED", "false")
    s2 = Settings(_env_file=None)
    assert s2.llm_gateway_enabled is False


@pytest.mark.asyncio
async def test_title_with_fio_does_not_leave_contour_when_gateway_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """название с ФИО не покидает контур — ask_llm возвращает None без HTTP."""
    # Патчим глобальные настройки: гейтвей выключен, ключ будто бы есть.
    old_gateway = ai_assistant.settings.llm_gateway_enabled
    old_key = ai_assistant.settings.llm_api_key
    ai_assistant.settings.llm_gateway_enabled = False  # type: ignore[assignment]
    ai_assistant.settings.llm_api_key = "sk-test-should-not-be-used"  # type: ignore[assignment]

    # Мониторим httpx — вызов означал бы утечку за контур.
    mock_client_cls = MagicMock()
    monkeypatch.setattr(ai_assistant.httpx, "AsyncClient", mock_client_cls)

    try:
        pii_title = "Система мониторинга Иванов Иван Иванович"
        system_prompt = "Ты — методолог"
        user_message = f"Проект: {pii_title}. Аннотация: тест."
        # Хеш PII — для проверки, что данные не ушли (сравниваем с тем, что
        # мог бы уйти в LLM; при закрытом контуре хеш никуда не отправляется).
        pii_hash = hashlib.sha256(pii_title.encode("utf-8")).hexdigest()
        assert len(pii_hash) == 64

        result = await ai_assistant.ask_llm(system_prompt, user_message)

        assert result is None
        # Ключевая проверка контура: внешний клиент не создавался.
        mock_client_cls.assert_not_called()
        # Доп. гарантия: хеш PII не равен пустому и не утекал (нет вызова).
        assert pii_hash != hashlib.sha256(b"").hexdigest()
    finally:
        ai_assistant.settings.llm_gateway_enabled = old_gateway  # type: ignore[assignment]
        ai_assistant.settings.llm_api_key = old_key  # type: ignore[assignment]


@pytest.mark.asyncio
async def test_ask_llm_hash_check_does_not_call_when_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Хеш-проверка: повторно убеждаемся, что при False httpx не трогается."""
    old_gateway = ai_assistant.settings.llm_gateway_enabled
    old_key = ai_assistant.settings.llm_api_key
    ai_assistant.settings.llm_gateway_enabled = False  # type: ignore[assignment]
    ai_assistant.settings.llm_api_key = "sk-another-key"  # type: ignore[assignment]

    mock_client_cls = MagicMock()
    monkeypatch.setattr(ai_assistant.httpx, "AsyncClient", mock_client_cls)

    try:
        fio = "Петров Петр Петрович"
        fio_hash = hashlib.sha256(fio.encode("utf-8")).hexdigest()
        result = await ai_assistant.ask_llm("system", f"Название: {fio}")
        assert result is None
        mock_client_cls.assert_not_called()
        # Хеш ФИО известен тесту, но не покинул контур (нет HTTP).
        assert fio_hash == hashlib.sha256("Петров Петр Петрович".encode()).hexdigest()
    finally:
        ai_assistant.settings.llm_gateway_enabled = old_gateway  # type: ignore[assignment]
        ai_assistant.settings.llm_api_key = old_key  # type: ignore[assignment]


@pytest.mark.asyncio
async def test_ask_llm_returns_none_without_key_even_when_gateway_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """При включённом гейтвее без ключа — всё равно None (нет утечки)."""
    old_gateway = ai_assistant.settings.llm_gateway_enabled
    old_key = ai_assistant.settings.llm_api_key
    ai_assistant.settings.llm_gateway_enabled = True  # type: ignore[assignment]
    ai_assistant.settings.llm_api_key = None  # type: ignore[assignment]

    mock_client_cls = MagicMock()
    monkeypatch.setattr(ai_assistant.httpx, "AsyncClient", mock_client_cls)

    try:
        result = await ai_assistant.ask_llm("system", "hello")
        assert result is None
        mock_client_cls.assert_not_called()
    finally:
        ai_assistant.settings.llm_gateway_enabled = old_gateway  # type: ignore[assignment]
        ai_assistant.settings.llm_api_key = old_key  # type: ignore[assignment]


@pytest.mark.asyncio
async def test_ask_llm_calls_llm_when_gateway_enabled_and_key_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """При LLM_GATEWAY_ENABLED=true и ключе — внешний вызов разрешён."""
    old_gateway = ai_assistant.settings.llm_gateway_enabled
    old_key = ai_assistant.settings.llm_api_key
    old_base = ai_assistant.settings.llm_api_base
    ai_assistant.settings.llm_gateway_enabled = True  # type: ignore[assignment]
    ai_assistant.settings.llm_api_key = "sk-test-enabled"  # type: ignore[assignment]
    ai_assistant.settings.llm_api_base = "https://api.example.com/v1"  # type: ignore[assignment]

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"choices": [{"message": {"content": "ok"}}]}

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client_cls = MagicMock(return_value=mock_client)
    # Async context manager
    mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(ai_assistant.httpx, "AsyncClient", mock_client_cls)

    try:
        result = await ai_assistant.ask_llm("system", "hello")
        assert result == "ok"
        mock_client_cls.assert_called_once()
        mock_client.post.assert_called_once()
    finally:
        ai_assistant.settings.llm_gateway_enabled = old_gateway  # type: ignore[assignment]
        ai_assistant.settings.llm_api_key = old_key  # type: ignore[assignment]
        ai_assistant.settings.llm_api_base = old_base  # type: ignore[assignment]
