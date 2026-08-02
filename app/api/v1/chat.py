from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import CurrentUser, DBSession
from app.schemas import ChatIn, ChatOut
from app.services.ai_assistant import process_chat

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatOut)
async def chat(
    payload: ChatIn,
    db: DBSession,
    user: CurrentUser,
) -> ChatOut:
    # process_chat выполняет RAG-поиск один раз и возвращает ответ + источники
    return await process_chat(db, payload, user)
