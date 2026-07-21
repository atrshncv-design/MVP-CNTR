from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import CurrentUser, DBSession
from app.schemas import ChatIn, ChatOut, RagDocumentOut
from app.services.ai_assistant import build_rag_context, process_chat

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatOut)
async def chat(
    payload: ChatIn,
    db: DBSession,
    user: CurrentUser,
) -> ChatOut:
    reply = await process_chat(db, payload, user)

    rag_context = await build_rag_context(db, payload.message, top_k=3)

    sources = []
    if rag_context:
        from app.services.rag import search_documents

        search_payload = type(
            "", (),
            {"query": payload.message, "doc_type": None, "ugt_level": None, "top_k": 3},
        )()
        results = await search_documents(db, search_payload)
        sources = [
            RagDocumentOut(
                id=r.document.id,
                title=r.document.title,
                doc_type=r.document.doc_type,
                ugt_level=r.document.ugt_level,
                raw_text=r.document.raw_text[:200],
                source_uri=r.document.source_uri,
                template_metadata=r.document.template_metadata,
            )
            for r in results
        ]

    return ChatOut(reply=reply, sources=sources)
