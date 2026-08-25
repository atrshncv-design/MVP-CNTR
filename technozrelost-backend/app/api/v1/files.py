"""Загрузка документов проекта (тикет 06 Friday RC).

Файлы: PDF/DOCX/XLSX/PNG/JPEG до 25 МБ; фактический MIME по сигнатуре;
MinIO-объекты с внутренними именами; ClamAV-карантин; версии документов.
Только clean-файл считается доказательством (статус scan_status).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select

from app.api.v1.projects import require_project_access
from app.core.deps import CurrentUser, DBSession
from app.db.models import ProjectDocument
from app.schemas import DocumentFileOut
from app.services.file_storage import (
    FileSizeExceeded,
    FileStorageError,
    read_stored_file,
    read_upload_limited,
    scanner,
    store_project_file,
)

router = APIRouter(tags=["files"])

SCAN_LABELS = {
    "pending": "На проверке",
    "clean": "Проверен",
    "infected": "Заражён",
    "error": "Ошибка проверки",
}


def _doc_out(doc: ProjectDocument) -> DocumentFileOut:
    return DocumentFileOut(
        id=doc.id,
        project_id=doc.project_id,
        title=doc.title,
        doc_type=doc.doc_type,
        file_name=doc.file_name,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        sha256=doc.sha256,
        scan_status=doc.scan_status,
        scan_result=doc.scan_result,
        version=doc.version,
        uploaded_by=doc.uploaded_by,
        created_at=doc.created_at.isoformat() if doc.created_at else None,
    )


async def _next_version(db: DBSession, project_id: int, title: str) -> int:
    current = await db.scalar(
        select(func.max(ProjectDocument.version)).where(
            ProjectDocument.project_id == project_id,
            ProjectDocument.title == title,
        )
    )
    return (current or 0) + 1


@router.post(
    "/projects/{project_id}/files",
    response_model=DocumentFileOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_project_file(
    project_id: int,
    db: DBSession,
    user: CurrentUser,
    file: Annotated[UploadFile, File(description="PDF/DOCX/XLSX/PNG/JPEG до 25 МБ")],
    title: str | None = None,
) -> DocumentFileOut:
    await require_project_access(db, project_id, user)

    try:
        data = await read_upload_limited(file)
    except FileSizeExceeded as exc:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, str(exc)) from exc
    try:
        stored = store_project_file(project_id, file.filename or "document", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    scan_status, scan_result = await scanner.scan(data)
    doc_title = title or (file.filename or "Документ")
    doc = ProjectDocument(
        project_id=project_id,
        title=doc_title,
        doc_type="file",
        storage_key=stored.storage_key,
        file_name=file.filename or "document",
        file_size=stored.size,
        mime_type=stored.mime_type,
        sha256=stored.sha256,
        scan_status=scan_status,
        scan_result=scan_result,
        version=await _next_version(db, project_id, doc_title),
        uploaded_by=user.id,
        status="uploaded",
    )
    db.add(doc)
    await db.commit()
    return _doc_out(doc)


@router.get("/projects/{project_id}/files", response_model=list[DocumentFileOut])
async def list_project_files(
    project_id: int, db: DBSession, user: CurrentUser
) -> list[DocumentFileOut]:
    await require_project_access(db, project_id, user)
    docs = (
        await db.execute(
            select(ProjectDocument)
            .where(ProjectDocument.project_id == project_id)
            .order_by(ProjectDocument.created_at.desc(), ProjectDocument.version.desc())
        )
    ).scalars().all()
    return [_doc_out(d) for d in docs]


@router.get("/files/{file_id}/download")
async def download_project_file(
    file_id: int, db: DBSession, user: CurrentUser
) -> Response:
    doc = await db.get(ProjectDocument, file_id)
    if doc is None or doc.storage_key is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Файл не найден")
    await require_project_access(db, doc.project_id, user)
    # Fail-closed (R05.3): скачивание разрешено только clean-файлам —
    # infected, pending и error (clamd недоступен) блокируются.
    if doc.scan_status != "clean":
        detail = (
            "Файл заблокирован антивирусом"
            if doc.scan_status == "infected"
            else "Антивирусная проверка не пройдена — скачивание недоступно"
        )
        raise HTTPException(status.HTTP_409_CONFLICT, detail)
    try:
        data = read_stored_file(doc.storage_key)
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return Response(
        content=data,
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.file_name or "file"}"'},
    )


@router.post("/files/{file_id}/rescan", response_model=DocumentFileOut)
async def rescan_project_file(
    file_id: int, db: DBSession, user: CurrentUser
) -> DocumentFileOut:
    doc = await db.get(ProjectDocument, file_id)
    if doc is None or doc.storage_key is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Файл не найден")
    await require_project_access(db, doc.project_id, user)
    try:
        data = read_stored_file(doc.storage_key)
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    doc.scan_status, doc.scan_result = await scanner.scan(data)
    await db.commit()
    return _doc_out(doc)
