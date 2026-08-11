from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession, require_role
from app.db.models import AuditTrailEntry, RagDocument, User
from app.schemas import (
    RagConsultantIn,
    RagConsultantOut,
    RagDocumentIn,
    RagDocumentOut,
    RagRetireIn,
    RagSearchIn,
    RagSearchResult,
)
from app.services.llm_client import LLMClient, get_rag_llm_client
from app.services.rag import (
    create_document,
    list_documents,
    list_templates,
    publish_document,
    retire_document,
    review_document,
    search_documents,
    upsert_document,
)
from app.services.rag_consultant import HONEST_REFUSAL, consultant_answer
from app.services.rag_limits import (
    BUDGET_MESSAGE,
    KILL_SWITCH_MESSAGE,
    RAG_METRICS,
    cap_output_tokens,
    enforce_rate_limits,
    log_rag_event,
    rag_cache_get,
    rag_cache_set,
    rag_daily_budget_exceeded,
    rag_kill_switch_active,
    record_rag_usage,
)
from app.services.topic_gate import (
    AMBIGUOUS_CLARIFICATION,
    BLOCK_MESSAGE,
    OFFTOPIC_REFUSAL,
    TopicVerdict,
    classify_topic,
    is_ip_blocked,
    record_offtopic,
    reset_counter,
    set_block,
)

router = APIRouter(prefix="/rag", tags=["rag"])

# Редакционный workflow базы знаний — только staff ЦНТР (тикет 01 ai-rag).
StaffUser = Annotated[User, Depends(require_role("cntr_admin", "cntr_manager"))]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _doc_out(doc: RagDocument) -> RagDocumentOut:
    return RagDocumentOut(
        id=doc.id,
        title=doc.title,
        doc_type=doc.doc_type,
        ugt_level=doc.ugt_level,
        raw_text=doc.raw_text,
        source_uri=doc.source_uri,
        template_metadata=doc.template_metadata or {},
        status=doc.status,
        version=doc.version,
        source_type=doc.source_type,
        is_ai_reviewed=doc.is_ai_reviewed,
        published_by=doc.published_by,
        published_at=_iso(doc.published_at),
        reviewed_by=doc.reviewed_by,
        reviewed_at=_iso(doc.reviewed_at),
        retired_at=_iso(doc.retired_at),
        created_at=_iso(doc.created_at),
    )


def _audit(user_id: int, action: str, document: RagDocument) -> AuditTrailEntry:
    return AuditTrailEntry(
        project_id=None,
        user_id=user_id,
        action=action,
        details={
            "document_id": document.id,
            "title": document.title,
            "doc_type": document.doc_type,
            "version": document.version,
        },
    )


@router.post("/templates", response_model=RagDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_template(
    payload: RagDocumentIn,
    db: DBSession,
    user: CurrentUser,
) -> RagDocumentOut:
    allowed_slugs = {"cntr_admin", "cntr_manager"}
    if not user.is_superuser and not any(r.slug in allowed_slugs for r in user.roles):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Только администраторы ЦНТР могут загружать шаблоны",
        )
    doc = await upsert_document(db, payload)
    return RagDocumentOut(
        id=doc.id,
        title=doc.title,
        doc_type=doc.doc_type,
        ugt_level=doc.ugt_level,
        raw_text=doc.raw_text,
        source_uri=doc.source_uri,
        template_metadata=doc.template_metadata,
    )


@router.post("/search", response_model=list[RagSearchResult])
async def search_rag(
    payload: RagSearchIn,
    db: DBSession,
    user: CurrentUser,
) -> list[RagSearchResult]:
    """Поиск по базе знаний.

    Возвращает ТОЛЬКО published-материалы (draft/retired исключены).
    Явный guard: payload не принимает project_id и любой пользовательский
    контекст (проекты/файлы/чаты не индексируются) — extra="forbid".
    """
    return await search_documents(db, payload)


@router.get("/templates", response_model=list[RagDocumentOut])
async def get_templates(
    db: DBSession,
    user: CurrentUser,
    doc_type: str | None = Query(None),
) -> list[RagDocumentOut]:
    docs = await list_templates(db, doc_type)
    return [
        RagDocumentOut(
            id=d.id,
            title=d.title,
            doc_type=d.doc_type,
            ugt_level=d.ugt_level,
            raw_text=d.raw_text,
            source_uri=d.source_uri,
            template_metadata=d.template_metadata,
        )
        for d in docs
    ]


@router.post("/documents", response_model=RagDocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document_endpoint(
    payload: RagDocumentIn,
    db: DBSession,
    user: StaffUser,
) -> RagDocumentOut:
    """Создание черновика материала (staff). В retrieval не попадает до публикации."""
    doc = await create_document(db, payload)
    db.add(_audit(user.id, "rag.document_created", doc))
    await db.commit()
    return _doc_out(doc)


@router.post("/documents/{doc_id}/review", response_model=RagDocumentOut)
async def review_document_endpoint(
    doc_id: int,
    db: DBSession,
    user: StaffUser,
) -> RagDocumentOut:
    """Prompt-injection review материала (staff). Обязателен перед публикацией."""
    doc = await review_document(db, doc_id, user.id)
    db.add(_audit(user.id, "rag.document_reviewed", doc))
    await db.commit()
    return _doc_out(doc)


@router.post("/documents/{doc_id}/publish", response_model=RagDocumentOut)
async def publish_document_endpoint(
    doc_id: int,
    db: DBSession,
    user: StaffUser,
) -> RagDocumentOut:
    """Публикация draft -> published (staff). Требует is_ai_reviewed=True."""
    doc = await publish_document(db, doc_id, user.id)
    db.add(_audit(user.id, "rag.document_published", doc))
    await db.commit()
    return _doc_out(doc)


@router.post("/documents/{doc_id}/retire", response_model=RagDocumentOut)
async def retire_document_endpoint(
    doc_id: int,
    db: DBSession,
    user: StaffUser,
    payload: RagRetireIn | None = None,
) -> RagDocumentOut:
    """Отзыв published -> retired (staff): запись в rag_retired_log + аудит.

    Retired-материал исчезает из retrieval без потери истории.
    """
    reason = payload.reason if payload else None
    doc = await retire_document(db, doc_id, user.id, reason)
    db.add(_audit(user.id, "rag.document_retired", doc))
    await db.commit()
    return _doc_out(doc)


@router.get("/documents", response_model=list[RagDocumentOut])
async def list_documents_endpoint(
    db: DBSession,
    user: StaffUser,
    status_filter: Literal["draft", "published", "retired"] | None = Query(
        None, alias="status"
    ),
) -> list[RagDocumentOut]:
    """Список материалов базы знаний (staff) с фильтром по статусу."""
    docs = await list_documents(db, status_filter)
    return [_doc_out(d) for d in docs]


# ─── Публичный read-only AI-консультант (тикет 02 ai-rag) ──────────────────
# Без авторизации: доступен посетителям. Read-only: отвечает ТОЛЬКО на
# published-материалах базы знаний, не имеет проектов/файлов/секретов/tools
# и не генерирует документы.

RagLLMClient = Annotated[LLMClient, Depends(get_rag_llm_client)]


@router.post("/chat", response_model=RagConsultantOut)
async def rag_chat_public(
    payload: RagConsultantIn,
    request: Request,
    db: DBSession,
    llm: RagLLMClient,
) -> RagConsultantOut:
    """Публичный read-only консультант (без auth, тикеты 02–04 ai-rag).

    Порядок защит (серверных, НЕ client state):
    1. kill switch (тикет 04) → 503 (остальной API работает);
    2. блокировка IP после N off-topic (тикет 03) → 429;
    3. rate limits (тикет 04): частота 10/15 мин и суточный 30/сутки, по IP,
       смена session_id ничего не обнуляет → 429;
    4. topic gate (тикет 03): off-topic → вежливый отказ, ambiguous → уточнение;
    5. кеш идентичных вопросов (тикет 04) — cache hit не тратит бюджет;
    6. дневной бюджет (тикет 04) → 429;
    7. ответ консультанта на published-материалах (тикет 02) + per-request
       потолок токенов + учёт расхода + запись в кеш.

    Метрики/логи — только счётчики, БЕЗ текстов вопросов и session_id.
    """
    ip = request.client.host if request.client else "unknown"
    session_id = payload.session_id or ""

    RAG_METRICS["requests_total"] += 1

    # 1. Kill switch: аварийное отключение /rag/chat (503), остальной API жив.
    if rag_kill_switch_active():
        RAG_METRICS["kill_switch_total"] += 1
        log_rag_event("kill_switch")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail=KILL_SWITCH_MESSAGE
        )

    # 2. Блокировка IP (тикет 03) — проверяется первой.
    if await is_ip_blocked(db, ip):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=BLOCK_MESSAGE,
            headers={"Retry-After": str(settings.rag_block_minutes * 60)},
        )

    # 3. Rate limits: частота + суточный, атомарный upsert по IP.
    await enforce_rate_limits(db, ip, session_id)

    # 4. Topic gate (тикет 03).
    verdict = classify_topic(payload.question)
    if verdict is TopicVerdict.OFF_TOPIC:
        count = await record_offtopic(db, ip, session_id)
        if count >= settings.rag_offtopic_limit:
            await set_block(db, ip, session_id)
            RAG_METRICS["refusals_total"] += 1
            log_rag_event("blocked")
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail=BLOCK_MESSAGE,
                headers={"Retry-After": str(settings.rag_block_minutes * 60)},
            )
        RAG_METRICS["refusals_total"] += 1
        log_rag_event("off_topic_refusal")
        return RagConsultantOut(reply=OFFTOPIC_REFUSAL, sources=[], refused=True)

    # on-topic и ambiguous прерывают последовательность off-topic.
    await reset_counter(db, ip, session_id)
    if verdict is TopicVerdict.AMBIGUOUS:
        RAG_METRICS["refusals_total"] += 1
        log_rag_event("ambiguous_clarification")
        return RagConsultantOut(
            reply=AMBIGUOUS_CLARIFICATION, sources=[], refused=True
        )

    # 5. Кеш идентичных вопросов: ответ уже посчитан — LLM/бюджет не тратим.
    cached = rag_cache_get(payload.question)
    if cached is not None:
        RAG_METRICS["cache_hits_total"] += 1
        log_rag_event("cache_hit")
        return cached

    # 6. Cost gate: дневной бюджет (запросы/токены, глобально).
    if await rag_daily_budget_exceeded(db):
        RAG_METRICS["budget_blocked_total"] += 1
        log_rag_event("budget_blocked")
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=BUDGET_MESSAGE,
        )

    answer = await consultant_answer(db, payload, llm)

    # 7. Per-request потолок токенов ответа + учёт расхода + кеш.
    answer.reply = cap_output_tokens(answer.reply)
    request_count, input_tokens, output_tokens = await record_rag_usage(
        db, input_chars=len(payload.question), output_chars=len(answer.reply)
    )
    rag_cache_set(payload.question, answer)

    llm_called = not (answer.refused and answer.reply == HONEST_REFUSAL)
    if llm_called:
        RAG_METRICS["llm_calls_total"] += 1
    if answer.refused:
        RAG_METRICS["refusals_total"] += 1
    RAG_METRICS["input_tokens_total"] += input_tokens
    RAG_METRICS["output_tokens_total"] += output_tokens
    log_rag_event(
        "answered",
        request_count=request_count,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    return answer
