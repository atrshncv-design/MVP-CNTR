from __future__ import annotations

from app.core.deps import CurrentUser, DBSession
from app.schemas import ChatIn, ChatMessage
from app.services.rag import search_documents

GIGACHAT_API_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"


async def build_rag_context(db: DBSession, query: str, top_k: int = 3) -> str:
    results = await search_documents(
        db,
        type("", (), {"query": query, "doc_type": None, "ugt_level": None, "top_k": top_k})(),
    )
    if not results:
        return ""
    parts = []
    for r in results:
        parts.append(f"[{r.document.doc_type}] {r.document.title}\n{r.document.raw_text[:500]}")
    return "\n\n---\n\n".join(parts)


async def ask_gigachat(system_prompt: str, user_message: str) -> str:
    import httpx

    settings_type = type("", (), {})
    settings = settings_type()
    settings.gigachat_credentials = None

    from app.core.config import settings as app_settings

    if not app_settings.gigachat_credentials or app_settings.gigachat_credentials == "change_me":
        return None

    auth_resp = httpx.post(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        data={"scope": "GIGACHAT_API_PERS"},
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Bearer {app_settings.gigachat_credentials}",
            "RqUID": "00000000-0000-0000-0000-000000000000",
        },
        verify=False,
    )
    if auth_resp.status_code != 200:
        return None
    token = auth_resp.json().get("access_token")

    resp = httpx.post(
        GIGACHAT_API_URL,
        json={
            "model": "GigaChat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.3,
            "max_tokens": 2000,
        },
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        verify=False,
    )
    if resp.status_code != 200:
        return None
    return resp.json()["choices"][0]["message"]["content"]


async def process_chat(
    db: DBSession,
    payload: ChatIn,
    user: CurrentUser,
) -> ChatMessage:
    query = payload.message

    rag_context = await build_rag_context(db, query)

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

    gigachat_response = await ask_gigachat(system_prompt, user_message)

    if gigachat_response:
        return ChatMessage(role="assistant", content=gigachat_response)

    if rag_context:
        fallback = (
            f"Нашёл в базе знаний следующие документы по вашему запросу:\n\n{rag_context}\n\n"
            "Для более точного ответа подключите API (установите GIGACHAT_CREDENTIALS в .env)."
        )
    else:
        fallback = (
            "К сожалению, по вашему запросу ничего не найдено в базе знаний. "
            "Попробуйте переформулировать вопрос или обратиться к документации ГОСТ Р 58048-2017."
        )
    return ChatMessage(role="assistant", content=fallback)
