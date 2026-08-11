"""Внедряемый LLM-клиент для публичного RAG-консультанта (тикет 02 ai-rag).

Интерфейс отделён от реализации: тесты подставляют test-double через
`app.dependency_overrides[get_rag_llm_client]`, продуктовый путь использует
`HttpLLMClient` — тонкую обёртку над существующим OpenAI-совместимым вызовом
`ask_llm` (тикет 14), без дублирования транспортного кода.
"""

from __future__ import annotations

from typing import Protocol


class LLMClient(Protocol):
    """Контракт LLM-провайдера.

    system_prompt (доверенный, фиксированный) строго отделён от user_message
    (недоверенный контент: вопрос + retrieval-материалы). Возвращает None,
    если ответ недоступен (нет ключа, ошибка/таймаут провайдера) — вызывающий
    код в этом случае использует честный fallback на retrieval-контексте.
    """

    async def complete(self, system_prompt: str, user_message: str) -> str | None: ...


class HttpLLMClient:
    """OpenAI-совместимый клиент поверх существующего ask_llm."""

    async def complete(self, system_prompt: str, user_message: str) -> str | None:
        from app.services.ai_assistant import ask_llm

        return await ask_llm(system_prompt, user_message)


def get_rag_llm_client() -> LLMClient:
    """FastAPI-зависимость: продуктовый LLM-клиент (переопределяется в тестах)."""
    return HttpLLMClient()
