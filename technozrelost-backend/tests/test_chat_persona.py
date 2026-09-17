"""Таск 02 — характер агента: тон, цитаты, уточнения, следующий шаг (R03, R04).

Швы: POST /chat (ответ/уточнение/отказ) и гейт фрагментов (регресс).
Синтез — через моки ask_llm (живого провайдера нет, на прод не ходим).
Значений секретов в тестах нет, только имена.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user

FORBIDDEN_IN_PROMPT = (
    "LLM_API_KEY",
    "OPENCODE_API_KEY",
    "llm_api_key",
    "change_me",
)

VAGUE_QUERY = "как получить УГТ-4"
RUDE_SHORT_QUERY = "дай УГТ-4 быстро"
SPECIFIC_QUERY = "Что такое УГТ 5 и какие критерии оценки?"
OUT_OF_CORPUS_QUERY = "Абракадабра несуществующий запрос зззззз шершавый"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _register(client: TestClient, role: str = "gk_customer") -> str:
    return register_test_user(
        client,
        email=_email("persona"),
        full_name="Persona User",
        role_slug=role,
    )["access_token"]


def _capture_llm(monkeypatch, reply: str) -> dict[str, str]:
    """Мок синтеза: фиксирует system/user промпты, возвращает reply."""
    from app.services import ai_assistant as module

    captured: dict[str, str] = {}

    async def fake(system_prompt: str, user_message: str) -> str:
        captured["system"] = system_prompt
        captured["user"] = user_message
        return reply

    monkeypatch.setattr(module, "ask_llm", fake)
    return captured


def _post_chat(client: TestClient, token: str, message: str):
    return client.post(
        "/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": message},
    )


def test_persona_text_markers() -> None:
    """R03: инструкция — деловой тон, свои слова, цитаты, следующий шаг."""
    from app.services.ai_assistant import SYSTEM_PERSONA

    for marker in (
        "вежливо",
        "деловым тоном",
        "своими словами",
        "цитат",
        "следующий шаг",
        "уточняющ",
        "откажись",
        "без выдумки",
        "ГОСТ Р 58048-2017",
    ):
        assert marker in SYSTEM_PERSONA, marker
    # Лицензии на выдумку нет: вместо «своих знаний» — честный отказ.
    assert "на основе своих знаний" not in SYSTEM_PERSONA
    for forbidden in FORBIDDEN_IN_PROMPT:
        assert forbidden not in SYSTEM_PERSONA, forbidden


def test_is_vague_question() -> None:
    """R03.1: эвристика vagueness — коротко без вопроса."""
    from app.services.ai_assistant import is_vague_question

    assert is_vague_question(VAGUE_QUERY) is True
    assert is_vague_question(RUDE_SHORT_QUERY) is True
    assert is_vague_question("УГТ-4") is True
    assert is_vague_question(SPECIFIC_QUERY) is False
    assert is_vague_question("Что такое УГТ?") is False
    assert is_vague_question("Критерии оценки УГТ 3 по ГОСТ") is False
    assert is_vague_question("") is False
    assert is_vague_question("   ") is False


def test_vague_query_steered_to_clarify(
    client: TestClient, monkeypatch
) -> None:
    """R03.1: «как получить УГТ-4» → steering-hint, персона в system, 200."""
    from app.services.ai_assistant import SYSTEM_PERSONA, VAGUE_HINT

    captured = _capture_llm(monkeypatch, "Уточните: для какой технологии нужен УГТ-4?")
    token = _register(client)
    response = _post_chat(client, token, VAGUE_QUERY)
    assert response.status_code == 200, response.text
    assert "УГТ-4" in response.json()["reply"]["content"]
    assert VAGUE_HINT[:30] in captured["user"]
    assert "уточняющ" in captured["user"]
    assert SYSTEM_PERSONA[:30] in captured["system"]
    assert "следующий шаг" in captured["system"]
    # Изоляция промпта на месте (не ослаблена).
    assert "только данные" in captured["system"]
    for forbidden in FORBIDDEN_IN_PROMPT:
        assert forbidden not in captured["system"], forbidden


def test_rude_short_query_gets_hint(client: TestClient, monkeypatch) -> None:
    """R03.1: грубый короткий запрос → уточнение/структура, не мусор."""
    from app.services.ai_assistant import VAGUE_HINT

    captured = _capture_llm(monkeypatch, "Помогу: уточните задачу под УГТ-4.")
    token = _register(client)
    response = _post_chat(client, token, RUDE_SHORT_QUERY)
    assert response.status_code == 200, response.text
    assert VAGUE_HINT[:30] in captured["user"]
    assert response.json()["reply"]["role"] == "assistant"


def test_specific_query_without_hint(client: TestClient, monkeypatch) -> None:
    """Развёрнутый вопрос идёт без steering-hint, персона на месте."""
    from app.services.ai_assistant import SYSTEM_PERSONA, VAGUE_HINT

    captured = _capture_llm(monkeypatch, "Ответ по существу.")
    token = _register(client)
    response = _post_chat(client, token, SPECIFIC_QUERY)
    assert response.status_code == 200, response.text
    assert VAGUE_HINT[:30] not in captured["user"]
    assert SYSTEM_PERSONA[:30] in captured["system"]


def test_out_of_corpus_refusal_directive(
    client: TestClient, monkeypatch
) -> None:
    """R03.3: вне корпуса — sources пусты, промпт требует отказа без выдумки."""
    captured = _capture_llm(
        monkeypatch,
        "В базе знаний ответа нет. Переформулируйте вопрос "
        "или обратитесь к документации ГОСТ Р 58048-2017.",
    )
    token = _register(client)
    response = _post_chat(client, token, OUT_OF_CORPUS_QUERY)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["sources"] == []
    assert "без выдумки" in captured["system"]
    assert "откажись" in captured["system"]
    assert "ГОСТ Р 58048-2017" in captured["system"]
    assert "цитат" in captured["system"]


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
