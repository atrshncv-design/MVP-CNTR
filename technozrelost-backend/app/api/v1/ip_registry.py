"""Реестр РИД (тикет 03 operations-modules): карточки, авторы, документы.

RBAC (зафиксировано):
* Создание/редактирование/удаление карточек и авторов — только staff
  (cntr_admin/cntr_manager/суперпользователь), иначе 403.
* Чтение: staff — всё; участник проекта (active) — карточки своего проекта;
  владелец организации-правообладателя (создатель org или участник с ролью
  admin/owner) — карточки своей организации. Чужие → 404 (IDOR не раскрывает
  существование карточки).
* Файлы: upload/download — участник проекта/владелец org/staff; чужие → 404.
* Предупреждения — детерминированные, вычисляются при чтении (без LLM).
* Аудит: ip_asset.created/updated/status_changed/author_added/author_removed/
  document_uploaded/deleted.
"""

from __future__ import annotations

import hashlib
import uuid
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status
from sqlalchemy import or_, select

from app.core.deps import CurrentUser, DBSession, is_cntr_staff
from app.db.models import (
    AuditTrailEntry,
    IpAsset,
    IpAuthor,
    IpDocument,
    OrganizationMember,
    Project,
    ProjectMember,
    User,
    UserOrganization,
)
from app.schemas import (
    IpAssetIn,
    IpAssetOut,
    IpAssetUpdateIn,
    IpAuthorIn,
    IpAuthorOut,
    IpDocumentOut,
)
from app.services.file_storage import (
    MAX_FILE_SIZE,
    FileStorageError,
    StoredFile,
    detect_mime,
    extension_for,
    read_stored_file,
    scanner,
    storage,
)
from app.services.ip_registry import (
    author_display_name,
    compute_ip_warnings,
)

router = APIRouter(prefix="/ip-assets", tags=["ip-assets"])

ORG_OWNER_ROLES = ("admin", "owner")


def _is_staff(user: User) -> bool:
    return user.is_superuser or is_cntr_staff(user)


def _require_staff(user: User) -> None:
    if not _is_staff(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Недостаточно прав")


def _fmt_date(value) -> str | None:
    return value.isoformat() if value is not None else None


def _fmt_dt(value) -> str | None:
    return value.isoformat() if value is not None else None


def store_ip_file(asset_id: int, original_name: str, data: bytes) -> StoredFile:
    """Валидация и сохранение файла РИД (объекты в общем file_storage)."""
    if len(data) > MAX_FILE_SIZE:
        raise ValueError(f"Файл превышает лимит {MAX_FILE_SIZE // (1024 * 1024)} МБ")
    mime = detect_mime(data)
    if mime is None:
        raise ValueError("Недопустимый формат: разрешены PDF, DOCX, XLSX, PNG, JPEG")
    key = f"ip-assets/{asset_id}/{uuid.uuid4().hex}.{extension_for(mime)}"
    storage.put(key, data, content_type=mime)
    return StoredFile(
        storage_key=key,
        sha256=hashlib.sha256(data).hexdigest(),
        size=len(data),
        mime_type=mime,
    )


async def _audit(
    db: DBSession,
    *,
    project_id: int | None,
    user_id: int,
    action: str,
    details: dict,
) -> None:
    db.add(
        AuditTrailEntry(
            project_id=project_id, user_id=user_id, action=action, details=details
        )
    )


async def _is_org_owner(db: DBSession, org_id: int, user_id: int) -> bool:
    """Владелец организации: создатель (created_by) или участник с ролью admin/owner."""
    org = await db.get(UserOrganization, org_id)
    if org is None:
        return False
    if org.created_by == user_id:
        return True
    membership = await db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    return membership is not None and membership.role_in_org in ORG_OWNER_ROLES


async def can_access_asset(db: DBSession, asset: IpAsset, user: User) -> bool:
    """Доступ: staff, создатель карточки, активный участник проекта,
    владелец организации-правообладателя."""
    if user.is_superuser or is_cntr_staff(user) or asset.created_by == user.id:
        return True
    if asset.project_id is not None:
        membership = await db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == asset.project_id,
                ProjectMember.user_id == user.id,
                ProjectMember.status == "active",
            )
        )
        if membership is not None:
            return True
    return (
        asset.owner_organization_id is not None
        and await _is_org_owner(db, asset.owner_organization_id, user.id)
    )


async def require_asset_access(db: DBSession, asset_id: int, user: User) -> IpAsset:
    asset = await db.get(IpAsset, asset_id)
    if asset is None or not await can_access_asset(db, asset, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Карточка РИД не найдена")
    return asset


async def _authors_out(db: DBSession, asset_id: int, is_staff: bool) -> list[dict]:
    """Авторы с маскировкой ПДн: staff — ФИО + user_id, остальные — «Автор N»."""
    authors = (
        await db.execute(
            select(IpAuthor).where(IpAuthor.ip_asset_id == asset_id).order_by(IpAuthor.id)
        )
    ).scalars().all()
    user_ids = {a.user_id for a in authors if a.user_id is not None}
    names: dict[int, str] = {}
    if user_ids:
        users = (
            await db.execute(select(User).where(User.id.in_(user_ids)))
        ).scalars().all()
        names = {u.id: u.full_name for u in users}
    result: list[dict] = []
    for author in authors:
        result.append(
            {
                "id": author.id,
                "ip_asset_id": author.ip_asset_id,
                "user_id": author.user_id if is_staff else None,
                "display_name": author_display_name(
                    author.id,
                    is_staff=is_staff,
                    user_full_name=names.get(author.user_id) if author.user_id else None,
                    external_name=author.name,
                ),
                "contribution": author.contribution,
            }
        )
    return result


async def _documents_out(db: DBSession, asset_id: int) -> list[dict]:
    docs = (
        await db.execute(
            select(IpDocument)
            .where(IpDocument.ip_asset_id == asset_id)
            .order_by(IpDocument.created_at.desc(), IpDocument.id.desc())
        )
    ).scalars().all()
    return [
        {
            "id": d.id,
            "ip_asset_id": d.ip_asset_id,
            "title": d.title,
            "mime": d.mime,
            "sha256": d.sha256,
            "scan_status": d.scan_status,
            "uploaded_by": d.uploaded_by,
            "created_at": _fmt_dt(d.created_at),
        }
        for d in docs
    ]


def _asset_payload(
    asset: IpAsset,
    *,
    authors: list[dict] | None = None,
    documents: list[dict] | None = None,
) -> dict:
    warnings = compute_ip_warnings(
        expiry_date=asset.expiry_date,
        owner_organization_id=asset.owner_organization_id,
    )
    return {
        "id": asset.id,
        "title": asset.title,
        "type": asset.type,
        "project_id": asset.project_id,
        "owner_organization_id": asset.owner_organization_id,
        "status": asset.status,
        "registration_number": asset.registration_number,
        "application_date": _fmt_date(asset.application_date),
        "registration_date": _fmt_date(asset.registration_date),
        "expiry_date": _fmt_date(asset.expiry_date),
        "restrictions": asset.restrictions,
        "created_by": asset.created_by,
        "created_at": _fmt_dt(asset.created_at),
        "updated_at": _fmt_dt(asset.updated_at),
        "warnings": warnings,
        "authors": authors or [],
        "documents": documents or [],
    }


async def _validate_refs(db: DBSession, project_id: int | None, org_id: int | None) -> None:
    if project_id is not None:
        project = await db.get(Project, project_id)
        if project is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    if org_id is not None:
        org = await db.get(UserOrganization, org_id)
        if org is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")


# ─── Карточки РИД ────────────────────────────────────────────────────────────

@router.post("", response_model=IpAssetOut, status_code=status.HTTP_201_CREATED)
async def create_ip_asset(
    payload: IpAssetIn, db: DBSession, user: CurrentUser
) -> IpAssetOut:
    _require_staff(user)
    await _validate_refs(db, payload.project_id, payload.owner_organization_id)
    asset = IpAsset(
        title=payload.title,
        type=payload.type,
        project_id=payload.project_id,
        owner_organization_id=payload.owner_organization_id,
        status=payload.status,
        registration_number=payload.registration_number,
        application_date=payload.application_date,
        registration_date=payload.registration_date,
        expiry_date=payload.expiry_date,
        restrictions=payload.restrictions,
        created_by=user.id,
    )
    db.add(asset)
    await db.flush()
    await _audit(
        db,
        project_id=asset.project_id,
        user_id=user.id,
        action="ip_asset.created",
        details={"ip_asset_id": asset.id, "title": asset.title, "type": asset.type},
    )
    await db.commit()
    await db.refresh(asset)
    return IpAssetOut(**_asset_payload(asset))


@router.get("", response_model=list[IpAssetOut])
async def list_ip_assets(db: DBSession, user: CurrentUser) -> list[IpAssetOut]:
    statement = select(IpAsset).order_by(IpAsset.updated_at.desc(), IpAsset.id.desc())
    if not _is_staff(user):
        my_projects = select(ProjectMember.project_id).where(
            ProjectMember.user_id == user.id,
            ProjectMember.status == "active",
        )
        my_orgs_created = select(UserOrganization.id).where(
            UserOrganization.created_by == user.id
        )
        my_orgs_member = select(OrganizationMember.organization_id).where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.role_in_org.in_(ORG_OWNER_ROLES),
        )
        statement = statement.where(
            or_(
                IpAsset.project_id.in_(my_projects),
                IpAsset.owner_organization_id.in_(my_orgs_created),
                IpAsset.owner_organization_id.in_(my_orgs_member),
                IpAsset.created_by == user.id,
            )
        )
    assets = (await db.execute(statement)).scalars().all()
    return [IpAssetOut(**_asset_payload(a)) for a in assets]


@router.get("/{asset_id}", response_model=IpAssetOut)
async def get_ip_asset(asset_id: int, db: DBSession, user: CurrentUser) -> IpAssetOut:
    asset = await require_asset_access(db, asset_id, user)
    authors = await _authors_out(db, asset.id, _is_staff(user))
    documents = await _documents_out(db, asset.id)
    return IpAssetOut(**_asset_payload(asset, authors=authors, documents=documents))


@router.patch("/{asset_id}", response_model=IpAssetOut)
async def update_ip_asset(
    asset_id: int, payload: IpAssetUpdateIn, db: DBSession, user: CurrentUser
) -> IpAssetOut:
    _require_staff(user)
    asset = await db.get(IpAsset, asset_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Карточка РИД не найдена")
    if payload.project_id is not None or payload.owner_organization_id is not None:
        await _validate_refs(db, payload.project_id, payload.owner_organization_id)

    changes: list[str] = []
    for field in (
        "title",
        "type",
        "project_id",
        "owner_organization_id",
        "status",
        "registration_number",
        "application_date",
        "registration_date",
        "expiry_date",
        "restrictions",
    ):
        value = getattr(payload, field)
        if value is not None:
            setattr(asset, field, value)
            changes.append(field)
    status_changed = "status" in changes
    old_status = asset.status if status_changed else None
    await _audit(
        db,
        project_id=asset.project_id,
        user_id=user.id,
        action="ip_asset.updated",
        details={"ip_asset_id": asset.id, "changed": changes},
    )
    if status_changed:
        await _audit(
            db,
            project_id=asset.project_id,
            user_id=user.id,
            action="ip_asset.status_changed",
            details={"ip_asset_id": asset.id, "from": old_status, "to": asset.status},
        )
    await db.commit()
    await db.refresh(asset)
    authors = await _authors_out(db, asset.id, True)
    documents = await _documents_out(db, asset.id)
    return IpAssetOut(**_asset_payload(asset, authors=authors, documents=documents))


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ip_asset(asset_id: int, db: DBSession, user: CurrentUser) -> Response:
    _require_staff(user)
    asset = await db.get(IpAsset, asset_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Карточка РИД не найдена")
    await _audit(
        db,
        project_id=asset.project_id,
        user_id=user.id,
        action="ip_asset.deleted",
        details={"ip_asset_id": asset.id, "title": asset.title},
    )
    await db.delete(asset)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Авторы ──────────────────────────────────────────────────────────────────

@router.post(
    "/{asset_id}/authors", response_model=IpAuthorOut, status_code=status.HTTP_201_CREATED
)
async def add_ip_author(
    asset_id: int, payload: IpAuthorIn, db: DBSession, user: CurrentUser
) -> IpAuthorOut:
    _require_staff(user)
    asset = await db.get(IpAsset, asset_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Карточка РИД не найдена")
    if (payload.user_id is None) == (payload.name is None):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Укажите ровно одно: user_id (пользователь платформы) или name (внешний автор)",
        )
    if payload.user_id is not None:
        author_user = await db.get(User, payload.user_id)
        if author_user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")
    else:
        author_user = None
    author = IpAuthor(
        ip_asset_id=asset.id,
        user_id=payload.user_id,
        name=payload.name,
        contribution=payload.contribution,
    )
    db.add(author)
    await db.flush()
    await _audit(
        db,
        project_id=asset.project_id,
        user_id=user.id,
        action="ip_asset.author_added",
        details={"ip_asset_id": asset.id, "author_id": author.id, "user_id": author.user_id},
    )
    await db.commit()
    await db.refresh(author)
    user_full_name = author_user.full_name if author_user is not None else None
    display_name = author_display_name(
        author.id,
        is_staff=True,
        user_full_name=user_full_name,
        external_name=author.name,
    )
    return IpAuthorOut(
        id=author.id,
        ip_asset_id=author.ip_asset_id,
        user_id=author.user_id,
        display_name=display_name,
        contribution=author.contribution,
    )


@router.delete(
    "/{asset_id}/authors/{author_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_ip_author(
    asset_id: int, author_id: int, db: DBSession, user: CurrentUser
) -> Response:
    _require_staff(user)
    asset = await db.get(IpAsset, asset_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Карточка РИД не найдена")
    author = await db.get(IpAuthor, author_id)
    if author is None or author.ip_asset_id != asset.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Автор не найден")
    await _audit(
        db,
        project_id=asset.project_id,
        user_id=user.id,
        action="ip_asset.author_removed",
        details={"ip_asset_id": asset.id, "author_id": author.id},
    )
    await db.delete(author)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Документы-файлы ─────────────────────────────────────────────────────────

@router.post(
    "/{asset_id}/documents",
    response_model=IpDocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_ip_document(
    asset_id: int,
    db: DBSession,
    user: CurrentUser,
    file: Annotated[UploadFile, File(description="PDF/DOCX/XLSX/PNG/JPEG до 25 МБ")],
    title: str | None = None,
) -> IpDocumentOut:
    asset = await require_asset_access(db, asset_id, user)
    data = await file.read()
    try:
        stored = store_ip_file(asset.id, file.filename or "document", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    scan_status, _scan_result = await scanner.scan(data)
    doc = IpDocument(
        ip_asset_id=asset.id,
        title=title or (file.filename or "Документ"),
        storage_key=stored.storage_key,
        mime=stored.mime_type,
        sha256=stored.sha256,
        scan_status=scan_status,
        uploaded_by=user.id,
    )
    db.add(doc)
    await db.flush()
    await _audit(
        db,
        project_id=asset.project_id,
        user_id=user.id,
        action="ip_asset.document_uploaded",
        details={
            "ip_asset_id": asset.id,
            "document_id": doc.id,
            "scan_status": scan_status,
        },
    )
    await db.commit()
    await db.refresh(doc)
    return IpDocumentOut(
        id=doc.id,
        ip_asset_id=doc.ip_asset_id,
        title=doc.title,
        mime=doc.mime,
        sha256=doc.sha256,
        scan_status=doc.scan_status,
        uploaded_by=doc.uploaded_by,
        created_at=_fmt_dt(doc.created_at),
    )


@router.get("/{asset_id}/documents", response_model=list[IpDocumentOut])
async def list_ip_documents(
    asset_id: int, db: DBSession, user: CurrentUser
) -> list[IpDocumentOut]:
    asset = await require_asset_access(db, asset_id, user)
    return [IpDocumentOut(**d) for d in await _documents_out(db, asset.id)]


async def _require_doc_access(db: DBSession, doc_id: int, user: User) -> IpDocument:
    doc = await db.get(IpDocument, doc_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Документ не найден")
    asset = await db.get(IpAsset, doc.ip_asset_id)
    if asset is None or not await can_access_asset(db, asset, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Документ не найден")
    return doc


@router.get("/documents/{doc_id}/download")
async def download_ip_document(doc_id: int, db: DBSession, user: CurrentUser) -> Response:
    doc = await _require_doc_access(db, doc_id, user)
    if doc.scan_status == "infected":
        raise HTTPException(status.HTTP_409_CONFLICT, "Файл заблокирован антивирусом")
    if doc.storage_key is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Файл не найден")
    try:
        data = read_stored_file(doc.storage_key)
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    # RFC 5987: кириллические названия не помещаются в latin-1 заголовок.
    ascii_fallback = doc.title.encode("ascii", "replace").decode() or "file"
    disposition = (
        f'attachment; filename="{ascii_fallback}"; '
        f"filename*=UTF-8''{quote(doc.title)}"
    )
    return Response(
        content=data,
        media_type=doc.mime or "application/octet-stream",
        headers={"Content-Disposition": disposition},
    )


@router.post("/documents/{doc_id}/rescan", response_model=IpDocumentOut)
async def rescan_ip_document(doc_id: int, db: DBSession, user: CurrentUser) -> IpDocumentOut:
    doc = await _require_doc_access(db, doc_id, user)
    if doc.storage_key is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Файл не найден")
    try:
        data = read_stored_file(doc.storage_key)
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    doc.scan_status, _scan_result = await scanner.scan(data)
    await db.commit()
    await db.refresh(doc)
    return IpDocumentOut(
        id=doc.id,
        ip_asset_id=doc.ip_asset_id,
        title=doc.title,
        mime=doc.mime,
        sha256=doc.sha256,
        scan_status=doc.scan_status,
        uploaded_by=doc.uploaded_by,
        created_at=_fmt_dt(doc.created_at),
    )
