"""Обсуждение заявок, PDF-заключение и очистка версий (тикет 09).

- POST/GET /projects/{pid}/requests/{rid}/comments — переписка по заявке (US 53)
- GET  /projects/{pid}/requests/{rid}/conclusion.pdf — PDF-заключение решения
- DELETE /projects/{pid}/files/old-versions — retention: удаление старых версий
  (кроме последней и версий, зафиксированных в снимках заявок)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import delete, func, select

from app.api.v1.projects import require_project_access
from app.core.deps import CurrentUser, DBSession, has_role
from app.db.models import (
    Project,
    ProjectDocument,
    ProjectMember,
    PromotionRequest,
    PromotionRequestDocument,
    RequestComment,
    User,
)
from app.schemas import CommentIn, CommentOut, RequestOut
from app.services.conclusion_pdf import build_conclusion_pdf
from app.services.file_storage import FileStorageError, storage

router = APIRouter(prefix="/projects", tags=["requests"])


def _is_staff(user: CurrentUser) -> bool:
    return has_role(user, "cntr_manager", "cntr_admin")


async def _require_request_access(
    db: DBSession, project_id: int, request_id: int, user: CurrentUser
) -> PromotionRequest:
    await require_project_access(db, project_id, user)
    req = await db.get(PromotionRequest, request_id)
    if req is None or req.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Заявка не найдена")
    return req


async def _comment_out(db: DBSession, comment: RequestComment) -> CommentOut:
    author = await db.get(User, comment.author_id)
    return CommentOut(
        id=comment.id,
        author_id=comment.author_id,
        author_name=author.full_name if author else "—",
        body=comment.body,
        created_at=comment.created_at.isoformat() if comment.created_at else None,
    )


@router.get("/{project_id}/requests", response_model=list[RequestOut])
async def list_project_requests(
    project_id: int, db: DBSession, user: CurrentUser
) -> list[RequestOut]:
    """Заявки проекта для участников (лента обсуждений, US 53)."""
    await require_project_access(db, project_id, user)
    requests = (
        (
            await db.execute(
                select(PromotionRequest)
                .where(PromotionRequest.project_id == project_id)
                .order_by(PromotionRequest.attempt_no.desc())
            )
        )
        .scalars()
        .all()
    )
    counts: dict[int, int] = {}
    if requests:
        rows = (
            await db.execute(
                select(RequestComment.promotion_request_id, func.count(RequestComment.id))
                .where(
                    RequestComment.promotion_request_id.in_([r.id for r in requests])
                )
                .group_by(RequestComment.promotion_request_id)
            )
        ).all()
        counts = {int(row[0]): int(row[1]) for row in rows}
    return [
        RequestOut(
            id=r.id,
            from_level=r.from_level,
            to_level=r.to_level,
            status=r.status,
            attempt_no=r.attempt_no,
            rejection_reason=r.rejection_reason,
            created_at=r.created_at.isoformat() if r.created_at else None,
            comments_count=counts.get(r.id, 0),
        )
        for r in requests
    ]


@router.get(
    "/{project_id}/requests/{request_id}/comments", response_model=list[CommentOut]
)
async def list_comments(
    project_id: int, request_id: int, db: DBSession, user: CurrentUser
) -> list[CommentOut]:
    await _require_request_access(db, project_id, request_id, user)
    comments = (
        (
            await db.execute(
                select(RequestComment)
                .where(RequestComment.promotion_request_id == request_id)
                .order_by(RequestComment.id)
            )
        )
        .scalars()
        .all()
    )
    return [await _comment_out(db, c) for c in comments]


@router.post(
    "/{project_id}/requests/{request_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    project_id: int,
    request_id: int,
    payload: CommentIn,
    db: DBSession,
    user: CurrentUser,
) -> CommentOut:
    req = await _require_request_access(db, project_id, request_id, user)
    if req.status == "approved":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Заявка подтверждена — комментарии закрыты"
        )
    comment = RequestComment(
        promotion_request_id=request_id,
        author_id=user.id,
        body=payload.body.strip(),
    )
    if not comment.body:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Пустой комментарий")
    db.add(comment)
    await db.commit()
    return await _comment_out(db, comment)


@router.get("/{project_id}/requests/{request_id}/conclusion.pdf")
async def download_conclusion(
    project_id: int, request_id: int, db: DBSession, user: CurrentUser
) -> Response:
    """PDF-заключение по рассмотренной заявке (участники и менеджеры)."""
    req = await _require_request_access(db, project_id, request_id, user)
    if req.status not in ("approved", "rejected"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Заключение доступно после решения менеджера",
        )
    project = await db.get(Project, project_id)
    manager = await db.get(User, req.manager_id) if req.manager_id else None
    pdf = build_conclusion_pdf(
        project_name=project.name if project else "—",
        project_code=f"ЦНТР-{project_id}",
        from_level=req.from_level,
        to_level=req.to_level,
        status=req.status,
        manager_name=manager.full_name if manager else "—",
        reason=req.rejection_reason,
        decided_at=req.updated_at,
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="conclusion-{project_id}-{request_id}.pdf"'
            )
        },
    )


@router.delete("/{project_id}/files/old-versions")
async def cleanup_old_versions(
    project_id: int, db: DBSession, user: CurrentUser
) -> dict:
    """Retention: удаляет старые версии документов (кроме последней на title),
    защищая версии, зафиксированные в неизменяемых снимках заявок."""
    project = await require_project_access(db, project_id, user)
    membership = await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id,
            ProjectMember.is_project_admin.is_(True),
        )
    )
    is_staff = _is_staff(user)
    if membership is None and not is_staff and project.created_by != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Очистка версий доступна администратору проекта или менеджеру",
        )

    documents = (
        (
            await db.execute(
                select(ProjectDocument).where(ProjectDocument.project_id == project_id)
            )
        )
        .scalars()
        .all()
    )
    latest_by_title: dict[tuple[str, str], int] = {}
    for doc in documents:
        key = (doc.title, doc.doc_type)
        latest_by_title[key] = max(latest_by_title.get(key, 0), doc.version or 1)

    protected_ids = set(
        (
            await db.execute(
                select(PromotionRequestDocument.project_document_id)
                .join(
                    PromotionRequest,
                    PromotionRequest.id
                    == PromotionRequestDocument.promotion_request_id,
                )
                .where(PromotionRequest.project_id == project_id)
            )
        )
        .scalars()
        .all()
    )

    removed = 0
    for doc in documents:
        is_latest = (doc.version or 1) == latest_by_title.get(
            (doc.title, doc.doc_type), 0
        )
        if is_latest or doc.id in protected_ids or doc.storage_key is None:
            continue
        try:
            if doc.storage_key:
                storage.remove(doc.storage_key)
        except FileStorageError:
            pass  # объект уже отсутствует — удаляем метаданные
        await db.execute(
            delete(ProjectDocument).where(ProjectDocument.id == doc.id)
        )
        removed += 1

    await db.commit()
    return {"removed": removed, "protected": len(protected_ids)}
