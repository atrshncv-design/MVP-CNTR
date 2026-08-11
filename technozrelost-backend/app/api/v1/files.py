"""Загрузка документов проекта (тикеты 06 Friday RC, 02 security-infrastructure).

Файлы: PDF/DOCX/XLSX/PNG/JPEG до 25 МБ; независимая проверка типа
(extension↔MIME↔signature); MinIO-объекты с внутренними именами;
ClamAV-карантин (pending/clean/infected/error); версии документов.

Карантин-гейт: до clean verdict файл не выдаётся — ни скачиванием, ни
подписанной ссылкой, ни обработкой/передачей AI (stage-заявки в stages.py
инициируются только для clean-файла; AI-контекст (ai_assistant/rag) работает
только с RagDocument, файлы проекта туда не попадают).

Решение (зафиксировано в тикете 02): прямой авторизованный download без
токена сохранён для совместимости (require_project_access + карантин-гейт);
signed-url — дополнительный короткоживущий канал выдачи.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select

from app.api.v1.projects import require_project_access
from app.core.deps import CurrentUser, DBSession
from app.db.models import AuditTrailEntry, ProjectDocument
from app.schemas import DocumentFileOut, SignedUrlOut
from app.services import security_metrics
from app.services.file_storage import (
    FileStorageError,
    read_stored_file,
    scanner,
    store_project_file,
)
from app.services.kill_switches import ensure_enabled
from app.services.signed_url import (
    SignedTokenExpired,
    SignedTokenInvalid,
    create_signed_token,
    verify_signed_token,
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


def _ensure_downloadable(doc: ProjectDocument) -> None:
    """Карантин-гейт: до clean файл не выдаётся (скачивание/подписанная ссылка).

    pending/error → 409 «на проверке»; infected → 409 «заблокирован».
    """
    if doc.scan_status == "infected":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Файл заблокирован антивирусом"
        )
    if doc.scan_status != "clean":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Файл на проверке: скачивание станет доступно после завершения антивирусной проверки",
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
    ensure_enabled("uploads")  # kill switch: загрузки off → 503
    await require_project_access(db, project_id, user)

    data = await file.read()
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
    await db.flush()  # назначает doc.id до аудит-записи
    # Append-only аудит: метаданные, без контента файла (тикет 03)
    db.add(
        AuditTrailEntry(
            project_id=project_id,
            user_id=user.id,
            action="files.uploaded",
            details={
                "file_id": doc.id,
                "file_name": doc.file_name,
                "file_size": stored.size,
                "sha256": stored.sha256,
                "scan_status": scan_status,
                "version": doc.version,
            },
        )
    )
    await db.commit()
    security_metrics.files_uploaded()
    if scan_status == "infected":
        security_metrics.files_infected()
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


async def _get_doc_or_404(db: DBSession, file_id: int) -> ProjectDocument:
    doc = await db.get(ProjectDocument, file_id)
    if doc is None or doc.storage_key is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Файл не найден")
    return doc


@router.get("/files/{file_id}/download")
async def download_project_file(
    file_id: int,
    db: DBSession,
    user: CurrentUser,
    token: str | None = Query(None, description="Подписанный токен (signed-url)"),
) -> Response:
    doc = await _get_doc_or_404(db, file_id)
    assert doc.storage_key is not None  # гарантировано _get_doc_or_404
    await require_project_access(db, doc.project_id, user)
    if token is not None:
        # Signed access (тикет 02): подпись + срок проверяются на лету,
        # authorization повторно проверяется выше (require_project_access).
        try:
            verify_signed_token(token, doc.id)
        except SignedTokenExpired as exc:
            raise HTTPException(status.HTTP_410_GONE, str(exc)) from exc
        except SignedTokenInvalid as exc:
            raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    _ensure_downloadable(doc)
    try:
        data = read_stored_file(doc.storage_key)
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    # Append-only аудит: метаданные, без контента файла (тикет 03)
    db.add(
        AuditTrailEntry(
            project_id=doc.project_id,
            user_id=user.id,
            action="files.downloaded",
            details={
                "file_id": doc.id,
                "file_name": doc.file_name,
                "file_size": doc.file_size,
                "via_signed_url": token is not None,
            },
        )
    )
    await db.commit()
    security_metrics.files_downloaded()
    return Response(
        content=data,
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.file_name or "file"}"'},
    )


@router.get("/files/{file_id}/signed-url", response_model=SignedUrlOut)
async def create_signed_url(
    file_id: int, db: DBSession, user: CurrentUser
) -> SignedUrlOut:
    """Короткоживущая подписанная ссылка на скачивание (HMAC, TTL 5–15 мин).

    Токен не хранится в БД; authorization и карантин проверяются при выдаче
    и повторно при скачивании.
    """
    doc = await _get_doc_or_404(db, file_id)
    await require_project_access(db, doc.project_id, user)
    _ensure_downloadable(doc)
    try:
        signed = create_signed_token(doc.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    ts = datetime.fromtimestamp(signed.expires_at, tz=timezone.utc)  # noqa: UP017
    return SignedUrlOut(
        file_id=doc.id,
        url=f"/api/v1/files/{doc.id}/download?token={signed.token}",
        expires_at=ts.isoformat(),
    )


@router.post("/files/{file_id}/rescan", response_model=DocumentFileOut)
async def rescan_project_file(
    file_id: int, db: DBSession, user: CurrentUser
) -> DocumentFileOut:
    doc = await _get_doc_or_404(db, file_id)
    assert doc.storage_key is not None  # гарантировано _get_doc_or_404
    await require_project_access(db, doc.project_id, user)
    try:
        data = read_stored_file(doc.storage_key)
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    doc.scan_status, doc.scan_result = await scanner.scan(data)
    # Append-only аудит: вердикт без контента файла (тикет 03)
    db.add(
        AuditTrailEntry(
            project_id=doc.project_id,
            user_id=user.id,
            action="files.rescanned",
            details={
                "file_id": doc.id,
                "file_name": doc.file_name,
                "scan_status": doc.scan_status,
                "scan_result": doc.scan_result,
            },
        )
    )
    await db.commit()
    security_metrics.files_rescanned()
    if doc.scan_status == "infected":
        security_metrics.files_infected()
    return _doc_out(doc)
