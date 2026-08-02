from __future__ import annotations

import hashlib

from sqlalchemy import select, text

from app.core.deps import DBSession
from app.core.embeddings import embed_text
from app.db.models import RagDocument
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

SQL_SEARCH_KNN = """
SELECT
    id,
    title,
    doc_type,
    ugt_level,
    raw_text,
    source_uri,
    template_metadata,
    created_at,
    1 - (embedding <=> CAST(:query_vec AS vector)) AS similarity
FROM public.rag_documents
WHERE embedding IS NOT NULL
  AND (:doc_type IS NULL OR doc_type = :doc_type)
  AND (:ugt_level IS NULL OR ugt_level = :ugt_level)
ORDER BY embedding <=> CAST(:query_vec AS vector)
LIMIT :top_k
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
