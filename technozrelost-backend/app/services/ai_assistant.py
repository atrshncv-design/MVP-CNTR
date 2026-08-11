"""AI-ассистент платформы: RAG-контекст + OpenAI-совместимый LLM с fallback.

Конфигурация через переменные окружения (см. app.core.config):
    LLM_API_BASE — базовый URL OpenAI-совместимого API (по умолчанию api.openai.com/v1)
    LLM_API_KEY  — ключ (кладёт пользователь в .env; без ключа — fallback на RAG-контекст)
    LLM_MODEL    — имя модели (по умолчанию gpt-4o-mini)
"""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.schemas import ChatIn, ChatMessage, ChatOut, RagDocumentOut, RagSearchIn
from app.services.rag import search_documents

LLM_TIMEOUT_SECONDS = 60


def _llm_config() -> tuple[str | None, str, str]:
    base = settings.llm_api_base.rstrip("/")
    key = settings.llm_api_key
    if key and key.strip() and key != "change_me":
        return key, base, settings.llm_model
    return None, base, settings.llm_model


async def ask_llm(system_prompt: str, user_message: str) -> str | None:
    """Вызов chat/completions OpenAI-совместимого API. None при отсутствии ключа/ошибке.

    Kill switch (тикет 03): при отключённом AI-контуре вызовы не выполняются —
    деградация как «модель недоступна» (None), без сетевых запросов.
    """
    from app.services import ai_metrics
    from app.services.kill_switches import is_enabled

    if not is_enabled("ai"):
        return None
    api_key, base, model = _llm_config()
    if api_key is None:
        return None
    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{base}/chat/completions",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2000,
                },
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
        if response.status_code != 200:
            ai_metrics.METRICS["errors_total"] += 1
            return None
        payload = response.json()
        return payload["choices"][0]["message"]["content"]
    except Exception:  # noqa: BLE001 — ассистент не должен падать из-за LLM
        ai_metrics.METRICS["errors_total"] += 1
        return None


async def _rag_lookup(
    db: DBSession, query: str, top_k: int = 3
) -> tuple[str, list[RagDocumentOut]]:
    """Один RAG-поиск на запрос: возвращает (текст контекста, источники).

    Единая точка построения контекста и источников — без дублирования
    между build_rag_context и process_chat (тикет 08).
    """
    results = await search_documents(db, RagSearchIn(query=query, top_k=top_k))
    if not results:
        return "", []
    parts: list[str] = []
    sources: list[RagDocumentOut] = []
    for r in results:
        parts.append(
            f"[{r.document.doc_type}] {r.document.title}\n{r.document.raw_text[:500]}"
        )
        sources.append(
            RagDocumentOut(
                id=r.document.id,
                title=r.document.title,
                doc_type=r.document.doc_type,
                ugt_level=r.document.ugt_level,
                raw_text=r.document.raw_text[:200],
                source_uri=r.document.source_uri,
                template_metadata=r.document.template_metadata,
            )
        )
    return "\n\n---\n\n".join(parts), sources


async def build_rag_context(db: DBSession, query: str, top_k: int = 3) -> str:
    context, _ = await _rag_lookup(db, query, top_k=top_k)
    return context


async def process_chat(db: DBSession, payload: ChatIn, user: CurrentUser) -> ChatOut:
    query = payload.message

    rag_context, sources = await _rag_lookup(db, query, top_k=3)

    system_prompt = (
        "Ты — AI-ассистент платформы «Технозрелость». "
        "Твоя задача — помогать пользователям с вопросами по методологии ГОСТ Р 58048-2017, "
        "уровням готовности технологий (УГТ 1-9), критериям оценки, документации. "
        "Отвечай кратко, по делу, на русском языке. "
        "Если есть релевантный контекст из базы знаний — используй его. "
        "Если контекста недостаточно — ответь на основе своих знаний."
    )

    if rag_context:
        user_message = (
            f"Контекст из базы знаний платформы:\n{rag_context}\n\n"
            f"Вопрос пользователя: {query}"
        )
    else:
        user_message = query

    from app.services import ai_metrics

    llm_reply = await ask_llm(system_prompt, user_message)

    if llm_reply:
        return ChatOut(reply=ChatMessage(role="assistant", content=llm_reply), sources=sources)
    ai_metrics.METRICS["fallbacks_total"] += 1

    if rag_context:
        fallback = (
            f"Нашёл в базе знаний следующие документы по вашему запросу:\n\n{rag_context}\n\n"
            "Для более точного ответа подключите API (установите LLM_API_KEY в .env)."
        )
    else:
        fallback = (
            "К сожалению, по вашему запросу ничего не найдено в базе знаний. "
            "Попробуйте переформулировать вопрос или обратиться к документации ГОСТ Р 58048-2017."
        )
    return ChatOut(reply=ChatMessage(role="assistant", content=fallback), sources=sources)
