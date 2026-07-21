from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DBSession
from app.schemas import RagDocumentIn, RagDocumentOut, RagSearchIn, RagSearchResult
from app.services.rag import list_templates, search_documents, upsert_document

router = APIRouter(prefix="/rag", tags=["rag"])


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
