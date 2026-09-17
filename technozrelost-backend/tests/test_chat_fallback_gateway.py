"""Таск 01 — честный фолбэк и включённый синтез (R01, R02, R04).

Швы: POST /chat (ответ/фолбэк) и гейт фрагментов (регресс). Живого
провайдера нет: синтез — через мок транспорта httpx, даун — через
ConnectError. Значений секретов в тестах нет, только dummy-заглушки.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user

FORBIDDEN_IN_USER_TEXT = (
    "LLM_API_KEY",
    "OPENCODE_API_KEY",
    "llm_api_key",
    "подключите API",
    "в окружении",
    "окружение",
    "change_me",
)

SEED_TITLE = "ГОСТ Р 58048-2017.pdf"
SEED_TEXT = (
    "Уровни готовности технологии УГТ критерии оценки "
    "ФОЛБЭКГЕЙТМАРКЕР шкала готовности производства"
)
SEED_QUERY = "Уровни готовности технологии УГТ критерии оценки"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _register(client: TestClient, role: str = "gk_customer") -> str:
    return register_test_user(
        client,
        email=_email("fallback"),
        full_name="Fallback User",
        role_slug=role,
    )["access_token"]


def _seed_gost(client: TestClient) -> None:
    admin_token = _register(client, "cntr_admin")
    response = client.post(
        "/api/v1/rag/templates",
        json={"title": SEED_TITLE, "doc_type": "gost", "raw_text": SEED_TEXT},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201, response.text


def _gateway_off(monkeypatch) -> None:
    from app.services import ai_assistant
    from app.services.ai_wiring import OPENCODE_API_KEY_ENV

    monkeypatch.setattr(ai_assistant.settings, "llm_gateway_enabled", False)
    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", None)
    monkeypatch.delenv(OPENCODE_API_KEY_ENV, raising=False)


def _gateway_on_no_key(monkeypatch) -> None:
    from app.services import ai_assistant
    from app.services.ai_wiring import OPENCODE_API_KEY_ENV

    monkeypatch.setattr(ai_assistant.settings, "llm_gateway_enabled", True)
    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", None)
    monkeypatch.delenv(OPENCODE_API_KEY_ENV, raising=False)


def _gateway_on_key(monkeypatch, key: str = "sk-test-fallback-dummy") -> None:
    from app.services import ai_assistant
    from app.services.ai_wiring import OPENCODE_API_KEY_ENV

    monkeypatch.setattr(ai_assistant.settings, "llm_gateway_enabled", True)
    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", key)
    monkeypatch.setattr(
        ai_assistant.settings, "llm_api_base", "https://api.example.com/v1"
    )
    monkeypatch.delenv(OPENCODE_API_KEY_ENV, raising=False)


def _mock_transport(monkeypatch, captured: dict, reply: str = "синтез-ок") -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.services import ai_assistant

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"choices": [{"message": {"content": reply}}]}

    mock_client = AsyncMock()

    async def _capture_post(url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        return mock_response

    mock_client.post.side_effect = _capture_post
    mock_client_cls = MagicMock(return_value=mock_client)
    mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(ai_assistant.httpx, "AsyncClient", mock_client_cls)


def _assert_no_service_strings(content: str) -> None:
    for forbidden in FORBIDDEN_IN_USER_TEXT:
        assert forbidden not in content, forbidden


def test_gateway_off_returns_honest_excerpts_without_secrets(
    client: TestClient, monkeypatch
) -> None:
    """Флаг off: отдельная ветка «нет синтеза» — выдержки с цитатами, 200."""
    _gateway_off(monkeypatch)
    _seed_gost(client)
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": SEED_QUERY},
    )
    assert response.status_code == 200, response.text
    content = response.json()["reply"]["content"]
    assert "Умный синтез выключен" in content
    assert "Нашёл в базе знаний" in content
    assert "ФОЛБЭКГЕЙТМАРКЕР" in content
    assert "«" in content and SEED_TITLE in content
    _assert_no_service_strings(content)


def test_no_key_returns_excerpts_without_secrets(
    client: TestClient, monkeypatch
) -> None:
    """Флаг on, ключа нет: синтез недоступен — выдержки, 200, без секретов."""
    _gateway_on_no_key(monkeypatch)
    _seed_gost(client)
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": SEED_QUERY},
    )
    assert response.status_code == 200, response.text
    content = response.json()["reply"]["content"]
    assert "Нашёл в базе знаний" in content
    assert "ФОЛБЭКГЕЙТМАРКЕР" in content
    _assert_no_service_strings(content)


def test_gateway_on_with_key_synthesizes(
    client: TestClient, monkeypatch
) -> None:
    """Флаг on + ключ жив: ответ синтезирован моделью, 200."""
    captured: dict = {}
    _mock_transport(monkeypatch, captured)
    _gateway_on_key(monkeypatch)
    _seed_gost(client)
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": SEED_QUERY},
    )
    assert response.status_code == 200, response.text
    assert response.json()["reply"]["content"] == "синтез-ок"


def test_model_down_returns_excerpts_without_500(
    client: TestClient, monkeypatch
) -> None:
    """Модель легла: выдержки по корпусу, а не 500 и не выдумка."""
    import httpx

    async def _down_post(self, *args, **kwargs):  # noqa: ARG001
        raise httpx.ConnectError("provider down")

    monkeypatch.setattr(httpx.AsyncClient, "post", _down_post)
    _gateway_on_key(monkeypatch)
    _seed_gost(client)
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": SEED_QUERY},
    )
    assert response.status_code == 200, response.text
    content = response.json()["reply"]["content"]
    assert "Нашёл в базе знаний" in content
    assert "ФОЛБЭКГЕЙТМАРКЕР" in content
    assert len(response.json()["sources"]) >= 1
    _assert_no_service_strings(content)


def test_empty_corpus_honest_no_docs_without_secrets(
    client: TestClient, monkeypatch
) -> None:
    """Пустой корпус: честное «ничего не найдено», 200, без секретов."""
    _gateway_off(monkeypatch)
    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Абракадабра несуществующий запрос зззззз"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "ничего не найдено" in data["reply"]["content"]
    assert data["sources"] == []
    _assert_no_service_strings(data["reply"]["content"])


def test_startup_probe_reports_presence_fact_only(monkeypatch, caplog) -> None:
    """Стартовая проба: факт наличия ключа, значение в логи не попадает."""
    from app.services import ai_assistant

    monkeypatch.setattr(ai_assistant.settings, "llm_gateway_enabled", True)
    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", "sk-test-probe-dummy")
    monkeypatch.setattr(ai_assistant.settings, "llm_model", "probe-model")
    with caplog.at_level("INFO", logger="app.services.ai_assistant"):
        status = ai_assistant.log_llm_startup_status()
    assert status == {
        "gateway_enabled": True,
        "key_present": True,
        "model": "probe-model",
    }
    logged = "\n".join(record.getMessage() for record in caplog.records)
    assert "sk-test-probe-dummy" not in logged
    assert "key_present" in logged

    caplog.clear()
    monkeypatch.setattr(ai_assistant.settings, "llm_gateway_enabled", False)
    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", None)
    with caplog.at_level("INFO", logger="app.services.ai_assistant"):
        status = ai_assistant.log_llm_startup_status()
    assert status["gateway_enabled"] is False
    assert status["key_present"] is False


def test_guardrails_regression() -> None:
    """R04: allowlist ГОСТов и обезличивание работают как раньше."""
    from app.services.ai_wiring import (
        sanitize_question_for_external,
        select_external_fragments,
    )

    redacted = sanitize_question_for_external(
        "почта ivan.petrov@example.com тел +7 916 123-45-67 про УГТ 5"
    )
    assert "ivan.petrov@example.com" not in redacted
    assert "916" not in redacted
    assert "УГТ 5" in redacted

    selected = select_external_fragments(
        [
            ("интервью ЦНТР.pdf", "внутренний секрет"),
            ("ГОСТ Р 58048-2017.pdf", "ГОСТ-МАРКЕР уровни готовности"),
        ]
    )
    names = [name for name, _ in selected]
    assert "ГОСТ Р 58048-2017.pdf" in names
    assert "интервью ЦНТР.pdf" not in names
