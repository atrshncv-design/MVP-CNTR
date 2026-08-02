from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.v1.projects import require_project_access
from app.core.deps import CurrentUser, DBSession
from app.schemas import GeneratedDocumentOut
from app.services.document_generator import generate_document

router = APIRouter(prefix="/projects", tags=["generation"])


@router.post("/{project_id}/generate/{doc_type}", response_model=GeneratedDocumentOut)
async def generate_project_document(
    project_id: int,
    doc_type: str,
    db: DBSession,
    user: CurrentUser,
) -> GeneratedDocumentOut:
    valid_types = {"tz", "passport", "teo"}
    if doc_type not in valid_types:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Неверный тип документа. Допустимые: {', '.join(valid_types)}",
        )
    await require_project_access(db, project_id, user)
    try:
        result = await generate_document(db, project_id, doc_type, user_id=user.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return result
