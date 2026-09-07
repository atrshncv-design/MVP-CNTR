from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.v1.projects import require_project_access
from app.core.deps import CurrentUser, DBSession
from app.core.errors import raise_error
from app.schemas import GeneratedDocumentOut
from app.services.document_generator import generate_document

router = APIRouter(prefix="/projects", tags=["generation"])


@router.post("/{project_id}/generate/{doc_type}", response_model=GeneratedDocumentOut)
async def generate_project_document(
    project_id: int,
    doc_type: str,
    request: Request,
    db: DBSession,
    user: CurrentUser,
) -> GeneratedDocumentOut:
    valid_types = {"tz", "passport", "teo"}
    if doc_type not in valid_types:
        raise raise_error(
            "DOC_INVALID_TYPE",
            {"valid_types": ", ".join(sorted(valid_types))},
            request=request,
        )
    await require_project_access(db, project_id, user, request)
    try:
        result = await generate_document(db, project_id, doc_type, user_id=user.id)
    except ValueError as exc:
        # document_generator бросает только два вида: отсутствие проекта
        # и отсутствие шаблона — маппим на коды в API-слое.
        if str(exc).startswith("Шаблон"):
            raise raise_error(
                "DOC_TEMPLATE_MISSING", {"doc_type": doc_type}, request=request
            ) from exc
        raise raise_error("PROJECT_NOT_FOUND", request=request) from exc
    return result
