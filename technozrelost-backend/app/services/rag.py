from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, text

from app.core.deps import DBSession
from app.core.embeddings import embed_text
from app.db.models import RagDocument, RagRetiredLog
from app.schemas import (
    RagDocumentIn,
    RagDocumentOut,
    RagSearchIn,
    RagSearchResult,
)

SQL_UPSERT_EMBEDDING = """
UPDATE public.rag_documents
SET embedding = CAST(:embedding AS vector)
WHERE id = :doc_id
"""

# Retrieval отдаёт ТОЛЬКО published-материалы (тикет 01 ai-rag):
# draft/retired не попадают в поиск; retired дополнительно исключается по retired_at.
SQL_SEARCH_KNN = """
SELECT
    id,
    title,
    doc_type,
    ugt_level,
    raw_text,
    source_uri,
    template_metadata,
    source_type,
    version,
    created_at,
    1 - (embedding <=> CAST(:query_vec AS vector)) AS similarity
FROM public.rag_documents
WHERE embedding IS NOT NULL
  AND status = 'published'
  AND retired_at IS NULL
  AND (CAST(:doc_type AS text) IS NULL OR doc_type = CAST(:doc_type AS text))
  AND (CAST(:ugt_level AS int) IS NULL OR ugt_level = CAST(:ugt_level AS int))
ORDER BY embedding <=> CAST(:query_vec AS vector)
LIMIT CAST(:top_k AS int)
"""


async def upsert_document(db: DBSession, payload: RagDocumentIn) -> RagDocument:
    content_hash = hashlib.sha256(payload.raw_text.encode("utf-8")).hexdigest()

    existing = await db.scalar(
        select(RagDocument).where(
            RagDocument.content_hash == content_hash,
            RagDocument.doc_type == payload.doc_type,
        )
    )
    if existing:
        existing.title = payload.title
        existing.raw_text = payload.raw_text
        existing.template_metadata = payload.template_metadata
        existing.ugt_level = payload.ugt_level
        existing.source_uri = payload.source_uri
        doc = existing
    else:
        doc = RagDocument(
            title=payload.title,
            doc_type=payload.doc_type,
            ugt_level=payload.ugt_level,
            content_hash=content_hash,
            raw_text=payload.raw_text,
            source_uri=payload.source_uri,
            template_metadata=payload.template_metadata,
            embedding=None,
        )
        db.add(doc)

    await db.commit()
    await db.refresh(doc)

    emb = embed_text(payload.raw_text)
    emb_str = "[" + ",".join(f"{v:.8f}" for v in emb) + "]"
    await db.execute(
        text(SQL_UPSERT_EMBEDDING),
        {"embedding": emb_str, "doc_id": doc.id},
    )
    await db.commit()
    await db.refresh(doc)
    return doc


async def create_document(db: DBSession, payload: RagDocumentIn) -> RagDocument:
    """Создание черновика материала базы знаний (только staff).

    Новый материал всегда появляется в статусе draft и не попадает в retrieval,
    пока не пройдёт prompt-injection review и публикацию.
    """
    content_hash = hashlib.sha256(payload.raw_text.encode("utf-8")).hexdigest()

    existing = await db.scalar(
        select(RagDocument).where(
            RagDocument.content_hash == content_hash,
            RagDocument.doc_type == payload.doc_type,
        )
    )
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Документ с таким содержимым уже существует",
        )

    doc = RagDocument(
        title=payload.title,
        doc_type=payload.doc_type,
        ugt_level=payload.ugt_level,
        content_hash=content_hash,
        raw_text=payload.raw_text,
        source_uri=payload.source_uri,
        template_metadata=payload.template_metadata,
        source_type=payload.source_type or "doc",
        status="draft",
        version=1,
        is_ai_reviewed=False,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Эмбеддинг считается сразу (детерминированный локальный хэш);
    # в retrieval документ попадёт только после публикации.
    emb = embed_text(payload.raw_text)
    emb_str = "[" + ",".join(f"{v:.8f}" for v in emb) + "]"
    await db.execute(
        text(SQL_UPSERT_EMBEDDING),
        {"embedding": emb_str, "doc_id": doc.id},
    )
    await db.commit()
    await db.refresh(doc)
    return doc


async def review_document(db: DBSession, doc_id: int, user_id: int) -> RagDocument:
    """Отметить прохождение prompt-injection review (обязательно перед публикацией)."""
    doc = await db.get(RagDocument, doc_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Документ не найден")
    doc.is_ai_reviewed = True
    doc.reviewed_by = user_id
    doc.reviewed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(doc)
    return doc


async def publish_document(db: DBSession, doc_id: int, user_id: int) -> RagDocument:
    """Публикация draft -> published. Без is_ai_reviewed=True — 400."""
    doc = await db.get(RagDocument, doc_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Документ не найден")
    if doc.status != "draft":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Публиковать можно только черновик (draft)",
        )
    if not doc.is_ai_reviewed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Требуется prompt-injection review (is_ai_reviewed=True)",
        )
    doc.status = "published"
    doc.published_by = user_id
    doc.published_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(doc)
    return doc


async def retire_document(
    db: DBSession, doc_id: int, user_id: int, reason: str | None = None
) -> RagDocument:
    """Отзыв published -> retired + append-only запись в rag_retired_log.

    Retired-материал исчезает из retrieval, история отзыва сохраняется.
    """
    doc = await db.get(RagDocument, doc_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Документ не найден")
    if doc.status == "retired":
        raise HTTPException(status.HTTP_409_CONFLICT, "Документ уже отозван")
    if doc.status != "published":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Отозвать можно только опубликованный документ",
        )
    doc.status = "retired"
    doc.retired_at = datetime.now(UTC)
    db.add(
        RagRetiredLog(
            document_id=doc.id,
            retired_by=user_id,
            reason=reason,
        )
    )
    await db.commit()
    await db.refresh(doc)
    return doc


async def list_documents(
    db: DBSession, doc_status: str | None = None
) -> list[RagDocument]:
    stmt = select(RagDocument).order_by(
        RagDocument.created_at.desc(), RagDocument.id.desc()
    )
    if doc_status:
        stmt = stmt.where(RagDocument.status == doc_status)
    rows = await db.execute(stmt)
    return list(rows.scalars().all())


async def search_documents(
    db: DBSession,
    payload: RagSearchIn,
) -> list[RagSearchResult]:
    query_vec = embed_text(payload.query)
    query_vec_str = "[" + ",".join(f"{v:.8f}" for v in query_vec) + "]"

    rows = await db.execute(
        text(SQL_SEARCH_KNN),
        {
            "query_vec": query_vec_str,
            "doc_type": payload.doc_type,
            "ugt_level": payload.ugt_level,
            "top_k": payload.top_k,
        },
    )

    results: list[RagSearchResult] = []
    for row in rows:
        results.append(
            RagSearchResult(
                document=RagDocumentOut(
                    id=row.id,
                    title=row.title,
                    doc_type=row.doc_type,
                    ugt_level=row.ugt_level,
                    raw_text=row.raw_text,
                    source_uri=row.source_uri,
                    template_metadata=row.template_metadata if row.template_metadata else {},
                    status="published",
                    version=row.version if row.version else 1,
                    source_type=row.source_type if row.source_type else "doc",
                ),
                similarity=float(row.similarity) if row.similarity else 0.0,
            )
        )
    return results


async def list_templates(db: DBSession, doc_type: str | None = None) -> list[RagDocument]:
    stmt = select(RagDocument).order_by(RagDocument.doc_type, RagDocument.title)
    if doc_type:
        stmt = stmt.where(RagDocument.doc_type == doc_type)
    rows = await db.execute(stmt)
    return list(rows.scalars().all())
