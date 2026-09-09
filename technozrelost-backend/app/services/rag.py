from __future__ import annotations

import hashlib
import logging
from typing import Any

from sqlalchemy import select, text

from app.core.deps import DBSession
from app.core.embeddings import embed_text, lexical_score, tokenize
from app.db.models import RagDocument
from app.schemas import (
    RagDocumentIn,
    RagDocumentOut,
    RagSearchIn,
    RagSearchResult,
)

logger = logging.getLogger(__name__)

SQL_UPSERT_EMBEDDING = """
UPDATE public.rag_documents
SET embedding = CAST(:embedding AS vector)
WHERE id = :doc_id
"""

SQL_SEARCH_KNN = """
SELECT
    id,
    title,
    doc_type,
    ugt_level,
    raw_text,
    source_uri,
    template_metadata,
    contour,
    created_at,
    1 - (embedding <=> CAST(:query_vec AS vector)) AS similarity
FROM public.rag_documents
WHERE embedding IS NOT NULL
  AND (CAST(:doc_type AS text) IS NULL OR doc_type = CAST(:doc_type AS text))
  AND (CAST(:ugt_level AS int) IS NULL OR ugt_level = CAST(:ugt_level AS int))
  AND (CAST(:contour AS text) IS NULL OR contour = CAST(:contour AS text))
ORDER BY embedding <=> CAST(:query_vec AS vector)
LIMIT CAST(:top_k AS int)
"""


async def upsert_document(db: DBSession, payload: RagDocumentIn) -> RagDocument:
    """Создание/обновление RAG-документа с контуром (tuno/kaba).

    Дедупликация по content_hash + doc_type + contour — один и тот же текст
    в разных контурах хранится раздельно (интервью 04). Эмбеддинг считается
    офлайн-моделью semantic-ru-v2 (нормализация, стемминг RU, синонимы).
    """

    content_hash = hashlib.sha256(payload.raw_text.encode("utf-8")).hexdigest()

    existing = await db.scalar(
        select(RagDocument).where(
            RagDocument.content_hash == content_hash,
            RagDocument.doc_type == payload.doc_type,
            RagDocument.contour == payload.contour,
        )
    )
    if existing:
        existing.title = payload.title
        existing.raw_text = payload.raw_text
        existing.template_metadata = payload.template_metadata
        existing.ugt_level = payload.ugt_level
        existing.source_uri = payload.source_uri
        existing.contour = payload.contour
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
            contour=payload.contour,
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


def _to_out(row: Any) -> RagDocumentOut:
    return RagDocumentOut(
        id=row.id,
        title=row.title,
        doc_type=row.doc_type,
        ugt_level=row.ugt_level,
        raw_text=row.raw_text,
        source_uri=row.source_uri,
        template_metadata=row.template_metadata if row.template_metadata else {},
        contour=row.contour if hasattr(row, "contour") and row.contour else "tuno",
    )


async def _lexical_fallback(
    db: DBSession,
    payload: RagSearchIn,
) -> list[RagSearchResult]:
    """Честный fallback без векторов: ILIKE-префильтр + лексический скоринг.

    Возвращает документы вместо молчания/500, similarity — лексический
    косинус по расширенным термам (0..1). Пустой запрос — пустой ответ.
    """
    terms = [t for t in tokenize(payload.query)][:6]
    if not terms:
        return []
    ors: list[str] = []
    params: dict[str, object] = {
        "doc_type": payload.doc_type,
        "ugt_level": payload.ugt_level,
        "contour": payload.contour,
        "limit": max(payload.top_k * 2, 10),
    }
    for i, term in enumerate(terms):
        key = f"q{i}"
        ors.append(f"(title ILIKE :{key} OR raw_text ILIKE :{key})")
        params[key] = f"%{term}%"
    sql = (
        "SELECT id, title, doc_type, ugt_level, raw_text, source_uri, "
        "template_metadata, contour, created_at FROM public.rag_documents WHERE ("
        + " OR ".join(ors)
        + ") AND (CAST(:doc_type AS text) IS NULL OR doc_type = CAST(:doc_type AS text))"
        + " AND (CAST(:ugt_level AS int) IS NULL OR ugt_level = CAST(:ugt_level AS int))"
        + " AND (CAST(:contour AS text) IS NULL OR contour = CAST(:contour AS text))"
        + " LIMIT CAST(:limit AS int)"
    )
    try:
        rows = await db.execute(text(sql), params)
    except Exception:
        logger.warning("rag lexical fallback: запрос к БД не удался")
        return []
    scored: list[tuple[float, Any]] = []
    for row in rows:
        lex = lexical_score(payload.query, f"{row.title} {row.raw_text}")
        scored.append((lex, row))
    scored.sort(key=lambda x: x[0], reverse=True)
    results: list[RagSearchResult] = []
    for lex, row in scored[: payload.top_k]:
        results.append(RagSearchResult(document=_to_out(row), similarity=float(lex)))
    return results


async def search_documents(
    db: DBSession,
    payload: RagSearchIn,
) -> list[RagSearchResult]:
    """Гибридный поиск: вектор KNN (fetch x4) + лексический rerank.

    Contour изолирует tuno/kaba на уровне SQL — два частичных ivfflat
    WHERE contour = ... (миграция 0029). None — поиск по всем контурам.
    Синонимы учитываются дважды: канонический токен в векторе и
    lexical_score при rerank. При недоступности модели — честный
    лексический fallback, а не молчание/500.
    """
    try:
        query_vec = embed_text(payload.query)
    except Exception:
        logger.warning("rag search: embedding-модель недоступна, лексический fallback")
        return await _lexical_fallback(db, payload)
    if not any(abs(v) > 1e-9 for v in query_vec):
        return await _lexical_fallback(db, payload)
    query_vec_str = "[" + ",".join(f"{v:.8f}" for v in query_vec) + "]"
    fetch_k = max(int(payload.top_k) * 4, 20)

    try:
        rows = await db.execute(
            text(SQL_SEARCH_KNN),
            {
                "query_vec": query_vec_str,
                "doc_type": payload.doc_type,
                "ugt_level": payload.ugt_level,
                "contour": payload.contour,
                "top_k": fetch_k,
            },
        )
    except Exception:
        logger.warning("rag search: векторный поиск не удался, лексический fallback")
        return await _lexical_fallback(db, payload)

    scored: list[tuple[float, float, float, Any]] = []
    for row in rows:
        vec_sim = float(row.similarity) if row.similarity else 0.0
        lex = lexical_score(payload.query, f"{row.title} {row.raw_text}")
        combined = 0.65 * vec_sim + 0.35 * lex
        scored.append((combined, vec_sim, lex, row))
    if not scored:
        return await _lexical_fallback(db, payload)
    scored.sort(key=lambda x: x[0], reverse=True)
    results: list[RagSearchResult] = []
    for combined, _vec_sim, _lex, row in scored[: payload.top_k]:
        results.append(RagSearchResult(document=_to_out(row), similarity=float(combined)))
    return results


async def list_templates(
    db: DBSession, doc_type: str | None = None, contour: str | None = None
) -> list[RagDocument]:
    stmt = select(RagDocument).order_by(RagDocument.doc_type, RagDocument.title)
    if doc_type:
        stmt = stmt.where(RagDocument.doc_type == doc_type)
    if contour:
        stmt = stmt.where(RagDocument.contour == contour)
    rows = await db.execute(stmt)
    return list(rows.scalars().all())
