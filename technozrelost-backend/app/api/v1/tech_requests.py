"""Технологический запрос заказчика (тикеты 01–02 requests-matching).

Тикет 01:
- POST   /tech-requests                — создать черновик (только верифицированный
                                         представитель организации + роль gk_customer)
- GET    /tech-requests                — свои запросы + все для Центра (staff)
- GET    /tech-requests/{id}           — создатель/staff; чужие → 404 (IDOR)
- PATCH  /tech-requests/{id}           — правка черновика создателем (версия + аудит)
- POST   /tech-requests/{id}/documents — вложение (versioned по title)
- POST   /tech-requests/{id}/submit    — фиксация draft → submitted (правки закрыты)

Тикет 02 (конфиденциальность и модерация):
- POST   /tech-requests/{id}/moderate  — решение менеджера approve/reject + причина
                                         (статус + append-only лог + аудит + уведомление)
- GET    /tech-requests/public         — публичный реестр (approved; public — всем,
                                         platform — авторизованным; пагинация)
- PATCH  visibility — смена режима; после approved → повторная модерация (pending)
- GET    /tech-requests/{id} — private скрыт от посторонних (404, не 403);
                                         public — все; platform — авторизованным
- Решение по reject: запрос возвращается создателю на доработку — PATCH и повторный
  submit разрешены (moderation_status → pending, новый цикл модерации); повторное
  решение менеджера возможно только после новой отправки/смены режима (409 иначе).

Тикет 03 (объяснимый базовый matcher):
- GET    /tech-requests/{id}/candidates — ранжированные кандидаты (создатель/staff;
                                         чужие → 404). Детерминированные баллы и
                                         объяснения БЕЗ LLM (app/services/matcher.py);
                                         закрытые поля запроса (budget/demand) в
                                         выдаче не участвуют ни для кого.
- POST   /tech-requests/{id}/candidates/{candidate_id}/decision — решение
  shortlist/reject + note (создатель/staff); сохраняется в
  tech_request_candidate_decisions (UNIQUE (request_id, candidate_id), повторное
  решение → 409); исходные данные кандидата/запроса не изменяются; аудит
  tech_request.candidate_decided.

Тикет 04 (управляемый контакт и связанный проект):
- POST   /tech-requests/{id}/offers — обезличенное предложение кандидату
  (только staff; БЕЗ контактов/закрытого содержания; UNIQUE (request_id,
  candidate_id) → 409; аудит tech_request.offer_created; уведомление кандидату).
- GET    /tech-requests/{id}/offers — офферы запроса (создатель/staff; чужой 404).
- GET    /offers/mine — лента кандидата: свои обезличенные офферы
  (отрасль/направление/УГТ/краткое описание; контакты — ТОЛЬКО после approved
  раскрытия).
- POST   /offers/{id}/accept — согласие кандидата → status accepted +
  responded_at + создание tech_request_disclosures pending (аудит
  tech_request.offer_accepted + tech_request.disclosure_requested; уведомление
  создателю запроса).
- POST   /offers/{id}/decline — отказ кандидата (аудит tech_request.offer_declined).
- POST   /disclosures/{id}/decide — решение staff/создателя запроса:
  approved → раскрытие контактов кандидату (аудит disclosure_approved +
  уведомление); denied → причина обязательна (аудит disclosure_denied).
- POST   /offers/{id}/project — связь с проектом (staff/создатель): новый
  проект наследует ТОЛЬКО выбранные поля (name/description/category/
  target_level из title/requirements/org_type/target_ugt) либо только связь
  с существующим; приглашение кандидата — через существующий join-флоу
  (join_token + POST /projects/join, auto_accept для verified/staff);
  аудит tech_request.project_linked.

Тикет 05 (AI-ранжирование кандидатов beta):
- GET    /tech-requests/{id}/candidates?ai=1 — базовая выдача + опциональный
  AI-порядок: {base, ai|null, beta, requires_review, note}. AI (внедряемый
  LLM-клиент, app/services/ai_ranking.py) получает только обезличенные поля
  (без email/контактов/budget/demand), возвращает только порядок candidate_id
  с баллами-объяснением, ничего не пишет в БД и не меняет статусы; отказ AI →
  ai=null, базовая выдача intact (ai_ranked=false); всё требует ручной
  проверки менеджером. Без ?ai=1 контракт прежний — list[RankedCandidateOut].

Зафиксированные решения тикета 03 (см. также docstring app/services/matcher.py):
1. Кандидаты доступны создателю и Центру при ЛЮБОМ статусе запроса — выдача не
   раскрывает запрос никому новому (только создатель/staff видят), поэтому гейт
   по moderation не требуется.
2. Признаки запроса выводятся детерминированно: направление/отрасль = org_type
   организации-заказчика, регион = её регион, целевой УГТ = max(current_level)
   проектов создателя; компетенции/оборудование/порог опыта в модели запроса
   отсутствуют → «не указано» (компонент 0 с объяснением, без штрафа).
3. Пул кандидатов — активные пользователи с ролями rd_executor /
   scientific_org / serial_manufacturer (как EXECUTOR_ROLE_SLUGS executors.py).
4. Повторное решение по кандидату — 409 (решение фиксируется, update не делаем).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select

from app.core.deps import (
    CurrentUser,
    CurrentUserOptional,
    DBSession,
    has_role,
)
from app.db.models import (
    AuditTrailEntry,
    OrganizationMember,
    Project,
    ProjectMember,
    Role,
    TechRequest,
    TechRequestCandidateDecision,
    TechRequestDisclosure,
    TechRequestDocument,
    TechRequestModerationLog,
    TechRequestOffer,
    TechRequestProject,
    User,
    UserOrganization,
    UserProfile,
    user_roles_tbl,
)
from app.schemas import (
    OFFER_SELECTABLE_FIELD_SOURCES,
    OFFER_SELECTABLE_FIELDS,
    AiCandidatesOut,
    AiRankedCandidateOut,
    AiRankingOut,
    CandidateSummaryOut,
    OfferContactOut,
    OfferMineOut,
    OfferRequestSummaryOut,
    RankedCandidateOut,
    TechRequestCandidateDecisionIn,
    TechRequestCandidateDecisionOut,
    TechRequestDisclosureIn,
    TechRequestDisclosureOut,
    TechRequestDocumentOut,
    TechRequestIn,
    TechRequestModerateIn,
    TechRequestOfferIn,
    TechRequestOfferOut,
    TechRequestOut,
    TechRequestPatch,
    TechRequestProjectIn,
    TechRequestProjectOut,
    TechRequestPublicOut,
    TechRequestPublicPage,
)
from app.services.ai_ranking import (
    LLMClient,
    get_ai_ranking_llm_client,
    rank_with_ai,
)
from app.services.file_storage import FileStorageError, scanner, store_request_file
from app.services.matcher import (
    CANDIDATE_POOL_ROLES,
    CandidateProfile,
    RequestFeatures,
    participant_type_names,
    rank,
)
from app.services.notifications import notify_user

router = APIRouter(prefix="/tech-requests", tags=["tech-requests"])
offers_router = APIRouter(prefix="/offers", tags=["tech-requests-offers"])
disclosures_router = APIRouter(prefix="/disclosures", tags=["tech-requests-disclosures"])

EDITABLE_STATUSES = ("draft",)


def _is_staff(user: CurrentUser) -> bool:
    return has_role(user, "cntr_manager", "cntr_admin")


def _editable(req: TechRequest) -> bool:
    """Правки возможны: черновик либо запрос, возвращённый на доработку (rejected)."""
    return req.status == "draft" or req.moderation_status == "rejected"


def _doc_out(doc: TechRequestDocument) -> TechRequestDocumentOut:
    return TechRequestDocumentOut(
        id=doc.id,
        request_id=doc.request_id,
        title=doc.title,
        file_name=doc.file_name,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        sha256=doc.sha256,
        scan_status=doc.scan_status,
        version=doc.version,
        uploaded_by=doc.uploaded_by,
        created_at=doc.created_at.isoformat() if doc.created_at else None,
    )


async def _documents(db: DBSession, request_id: int) -> list[TechRequestDocument]:
    return list(
        (
            await db.execute(
                select(TechRequestDocument)
                .where(TechRequestDocument.request_id == request_id)
                .order_by(TechRequestDocument.id)
            )
        )
        .scalars()
        .all()
    )


async def _out(db: DBSession, req: TechRequest) -> TechRequestOut:
    org = await db.get(UserOrganization, req.organization_id)
    docs = await _documents(db, req.id)
    return TechRequestOut(
        id=req.id,
        created_by=req.created_by,
        organization_id=req.organization_id,
        organization_name=org.name if org else None,
        title=req.title,
        requirements=req.requirements,
        demand=req.demand,
        deadline=req.deadline.isoformat() if req.deadline else "",
        budget=float(req.budget) if req.budget is not None else None,
        status=req.status,
        visibility=req.visibility,
        moderation_status=req.moderation_status,
        moderated_by=req.moderated_by,
        moderated_at=req.moderated_at.isoformat() if req.moderated_at else None,
        moderation_reason=req.moderation_reason,
        version=req.version,
        created_at=req.created_at.isoformat() if req.created_at else None,
        updated_at=req.updated_at.isoformat() if req.updated_at else None,
        documents=[_doc_out(doc) for doc in docs],
    )


def _future_deadline(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    if value <= datetime.now(UTC):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Срок выполнения (deadline) должен быть в будущем",
        )
    return value


async def _require_verified_representative(
    db: DBSession, user: CurrentUser, organization_id: int
) -> UserOrganization:
    """Только верифицированный представитель организации создаёт запрос от её имени."""
    if not has_role(user, "gk_customer"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Создавать технологические запросы может только заказчик (роль gk_customer)",
        )
    org = await db.get(UserOrganization, organization_id)
    if org is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Организация не найдена или недоступна",
        )
    membership = await db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Вы не являетесь представителем этой организации",
        )
    if org.state != "verified":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Запрос можно создавать только от верифицированной организации "
            f"(сейчас «{org.state}»)",
        )
    return org


async def _require_own_request(
    db: DBSession, request_id: int, user: CurrentUser
) -> TechRequest:
    """Запрос виден только создателю и Центру; чужие → 404 (IDOR)."""
    req = await db.get(TechRequest, request_id)
    if req is None or (req.created_by != user.id and not _is_staff(user)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запрос не найден")
    return req


async def _require_editable_own_request(
    db: DBSession, request_id: int, user: CurrentUser
) -> TechRequest:
    """Правки/вложения/отправка — только создатель; черновик либо rejected."""
    req = await _require_own_request(db, request_id, user)
    if req.created_by != user.id:
        if _is_staff(user):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Редактировать запрос может только его создатель",
            )
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запрос не найден")
    if not _editable(req):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Запрос в состоянии «{req.status}» — правки закрыты",
        )
    return req


async def _visible_request(
    db: DBSession, request_id: int, user: CurrentUserOptional
) -> TechRequest | None:
    """Запрос виден: создателю/Центру всегда; остальным — только approved.

    private → 404 (существование не раскрывается); platform — авторизованным;
    public — всем (включая анонимов).
    """
    req = await db.get(TechRequest, request_id)
    if req is None:
        return None
    if user is not None and (req.created_by == user.id or _is_staff(user)):
        return req
    if req.moderation_status != "approved":
        return None
    if req.visibility == "private":
        return None
    if req.visibility == "platform" and user is None:
        return None
    return req


@router.post("", response_model=TechRequestOut, status_code=status.HTTP_201_CREATED)
async def create_tech_request(
    payload: TechRequestIn, db: DBSession, user: CurrentUser
) -> TechRequestOut:
    """Создание черновика технологического запроса (verified представитель)."""
    await _require_verified_representative(db, user, payload.organization_id)
    deadline = _future_deadline(payload.deadline)
    req = TechRequest(
        created_by=user.id,
        organization_id=payload.organization_id,
        title=payload.title.strip(),
        requirements=payload.requirements.strip(),
        demand=payload.demand.strip() if payload.demand else None,
        deadline=deadline,
        budget=payload.budget,
        status="draft",
        version=1,
    )
    db.add(req)
    await db.flush()
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.created",
            details={
                "request_id": req.id,
                "organization_id": req.organization_id,
                "version": req.version,
            },
        )
    )
    await db.commit()
    await db.refresh(req)
    return await _out(db, req)


@router.get("", response_model=list[TechRequestOut])
async def list_tech_requests(db: DBSession, user: CurrentUser) -> list[TechRequestOut]:
    """Свои запросы (создатель) или все запросы (Центр/staff)."""
    if _is_staff(user):
        stmt = select(TechRequest).order_by(TechRequest.created_at.desc())
    else:
        stmt = (
            select(TechRequest)
            .where(TechRequest.created_by == user.id)
            .order_by(TechRequest.created_at.desc())
        )
    rows = (await db.execute(stmt)).scalars().all()
    return [await _out(db, req) for req in rows]


@router.get("/public", response_model=TechRequestPublicPage)
async def public_tech_requests(
    db: DBSession,
    user: CurrentUserOptional,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> TechRequestPublicPage:
    """Публичный реестр: только approved; public — всем, platform — авторизованным.

    Пагинация limit/offset; конфиденциальные поля (создатель, документы)
    не раскрываются; private в реестре отсутствует.
    """
    conditions = [TechRequest.moderation_status == "approved"]
    if user is None:
        conditions.append(TechRequest.visibility == "public")
    else:
        conditions.append(TechRequest.visibility.in_(("public", "platform")))
    base = select(TechRequest).where(*conditions)
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = (
        (
            await db.execute(
                base.order_by(
                    TechRequest.created_at.desc(), TechRequest.id.desc()
                )
                .offset(offset)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    items: list[TechRequestPublicOut] = []
    for req in rows:
        org = await db.get(UserOrganization, req.organization_id)
        items.append(
            TechRequestPublicOut(
                id=req.id,
                title=req.title,
                requirements=req.requirements,
                organization_name=org.name if org else None,
                demand=req.demand,
                deadline=req.deadline.isoformat() if req.deadline else "",
                budget=float(req.budget) if req.budget is not None else None,
                created_at=req.created_at.isoformat() if req.created_at else None,
            )
        )
    return TechRequestPublicPage(
        items=items, total=total or 0, limit=limit, offset=offset
    )


@router.get("/{request_id}", response_model=TechRequestOut)
async def get_tech_request(
    request_id: int, db: DBSession, user: CurrentUserOptional
) -> TechRequestOut:
    """Детали запроса по режиму видимости (тикет 02).

    Создатель/Центр — всегда; остальным — только approved: public (все) /
    platform (авторизованные); private для посторонних → 404 (не 403).
    """
    req = await _visible_request(db, request_id, user)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запрос не найден")
    return await _out(db, req)


@router.patch("/{request_id}", response_model=TechRequestOut)
async def update_tech_request(
    request_id: int, payload: TechRequestPatch, db: DBSession, user: CurrentUser
) -> TechRequestOut:
    """Правка запроса создателем: версия +1 и аудит tech_request.updated.

    Тикет 02: опциональный visibility; после approved смена режима →
    повторная модерация (pending + лог visibility_changed). После submit
    (approved/pending) допустима только смена режима — остальные поля 409.
    """
    req = await _require_own_request(db, request_id, user)
    if req.created_by != user.id:
        if _is_staff(user):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Редактировать запрос может только его создатель",
            )
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запрос не найден")

    changes: dict[str, object] = {}
    if payload.title is not None:
        req.title = payload.title.strip()
        changes["title"] = req.title
    if payload.requirements is not None:
        req.requirements = payload.requirements.strip()
        changes["requirements"] = req.requirements
    if payload.demand is not None:
        req.demand = payload.demand.strip() or None
        changes["demand"] = req.demand
    if payload.deadline is not None:
        req.deadline = _future_deadline(payload.deadline)
        changes["deadline"] = req.deadline.isoformat()
    if payload.budget is not None:
        req.budget = payload.budget
        changes["budget"] = float(payload.budget)

    content_changed = bool(changes)
    if content_changed and not _editable(req):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Запрос отправлен — правки закрыты (доступна только смена режима видимости)",
        )

    new_visibility = payload.visibility
    visibility_changed = (
        new_visibility is not None and new_visibility != req.visibility
    )
    if visibility_changed:
        changes["visibility"] = new_visibility
    if not changes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Нет изменяемых полей")

    req.version += 1
    if content_changed:
        db.add(
            AuditTrailEntry(
                user_id=user.id,
                action="tech_request.updated",
                details={
                    "request_id": req.id,
                    "version": req.version,
                    "changed": sorted(changes),
                },
            )
        )
    if visibility_changed:
        assert new_visibility is not None
        old_visibility = req.visibility
        req.visibility = new_visibility
        db.add(
            TechRequestModerationLog(
                request_id=req.id,
                action="visibility_changed",
                moderator_id=user.id,
                reason=f"Режим изменён: {old_visibility} → {req.visibility}",
            )
        )
        db.add(
            AuditTrailEntry(
                user_id=user.id,
                action="tech_request.visibility_changed",
                details={
                    "request_id": req.id,
                    "from": old_visibility,
                    "to": req.visibility,
                    "version": req.version,
                },
            )
        )
        if req.moderation_status == "approved":
            # Смена режима после одобрения → повторная модерация
            req.moderation_status = "pending"
            req.moderated_by = None
            req.moderated_at = None
            req.moderation_reason = None
    await db.commit()
    await db.refresh(req)
    return await _out(db, req)


@router.post(
    "/{request_id}/documents",
    response_model=TechRequestDocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_tech_request_document(
    request_id: int,
    db: DBSession,
    user: CurrentUser,
    file: Annotated[UploadFile, File()],
    title: Annotated[str | None, Form()] = None,
) -> TechRequestDocumentOut:
    """Вложение запроса; новая версия при том же title (versioned)."""
    req = await _require_editable_own_request(db, request_id, user)
    data = await file.read()
    try:
        stored = store_request_file(req.id, file.filename or "document", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    scan_status, _scan_result = await scanner.scan(data)

    doc_title = (title or file.filename or "Документ").strip() or "Документ"
    current = await db.scalar(
        select(func.max(TechRequestDocument.version)).where(
            TechRequestDocument.request_id == req.id,
            TechRequestDocument.title == doc_title,
        )
    )
    doc = TechRequestDocument(
        request_id=req.id,
        title=doc_title,
        version=(current or 0) + 1,
        storage_key=stored.storage_key,
        file_name=file.filename or "document",
        file_size=stored.size,
        mime_type=stored.mime_type,
        sha256=stored.sha256,
        scan_status=scan_status,
        uploaded_by=user.id,
    )
    db.add(doc)
    await db.flush()
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.document_added",
            details={
                "request_id": req.id,
                "document_id": doc.id,
                "version": doc.version,
                "title": doc_title,
            },
        )
    )
    await db.commit()
    return _doc_out(doc)


@router.post("/{request_id}/submit", response_model=TechRequestOut)
async def submit_tech_request(
    request_id: int, db: DBSession, user: CurrentUser
) -> TechRequestOut:
    """Фиксация запроса: draft → submitted; после этого правки закрыты (409).

    Тикет 02: после reject создатель дорабатывает запрос и повторно отправляет —
    moderation_status сбрасывается в pending (новый цикл модерации).
    """
    req = await _require_editable_own_request(db, request_id, user)
    req.status = "submitted"
    if req.moderation_status == "rejected":
        req.moderation_status = "pending"
        req.moderated_by = None
        req.moderated_at = None
        req.moderation_reason = None
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.submitted",
            details={"request_id": req.id, "version": req.version},
        )
    )
    await db.commit()
    await db.refresh(req)
    return await _out(db, req)


@router.post("/{request_id}/moderate", response_model=TechRequestOut)
async def moderate_tech_request(
    request_id: int,
    payload: TechRequestModerateIn,
    db: DBSession,
    user: CurrentUser,
) -> TechRequestOut:
    """Решение менеджера (cntr_manager/cntr_admin): approve/reject + причина.

    Решение пишется в append-only лог, аудит tech_request.moderated и
    уведомление создателю. Повторное решение возможно только после новой
    отправки (submit после reject) или смены режима после approved —
    иначе 409.
    """
    if not _is_staff(user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Модерировать запросы может только сотрудник Центра",
        )
    req = await db.get(TechRequest, request_id)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запрос не найден")
    if req.status != "submitted":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Запрос ещё не отправлен на модерацию (status={req.status})",
        )
    if req.moderation_status != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Запрос уже рассмотрен ({req.moderation_status}); повторное решение "
            f"возможно только после новой отправки или смены режима",
        )
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Причина решения обязательна",
        )
    decision = "approved" if payload.approve else "rejected"
    req.moderation_status = decision
    req.moderated_by = user.id
    req.moderated_at = datetime.now(UTC)
    req.moderation_reason = reason
    db.add(
        TechRequestModerationLog(
            request_id=req.id,
            action="approve" if payload.approve else "reject",
            moderator_id=user.id,
            reason=reason,
        )
    )
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.moderated",
            details={
                "request_id": req.id,
                "decision": decision,
                "reason": reason,
                "moderator_id": user.id,
            },
        )
    )
    await notify_user(
        db,
        req.created_by,
        "tech_request.moderated",
        f"Технологический запрос «{req.title}»: решение Центра — "
        f"{'одобрен' if payload.approve else 'отклонён'}",
        {"request_id": req.id, "decision": decision, "reason": reason},
    )
    await db.commit()
    await db.refresh(req)
    return await _out(db, req)


# ── Тикет 03: matcher — ранжированные кандидаты и решения ────────────────────


async def _request_features(db: DBSession, req: TechRequest) -> RequestFeatures:
    """Структурированные признаки запроса (детерминированно из данных).

    - направление/отрасль = org_type организации-заказчика (как в каталоге
      исполнителей executors.py);
    - регион = регион организации-заказчика;
    - целевой УГТ = max(current_level) проектов создателя (текущий уровень
      зрелости заказчика); при отсутствии проектов — None (не оценивается);
    - компетенции/оборудование/порог опыта в модели запроса отсутствуют →
      «не указано» (компоненты 0 с объяснением, без штрафа кандидату).
    """
    org = await db.get(UserOrganization, req.organization_id)
    levels = (
        (
            await db.execute(
                select(Project.current_level).where(Project.created_by == req.created_by)
            )
        )
        .scalars()
        .all()
    )
    int_levels = [int(level) for level in levels if level]
    return RequestFeatures(
        category=org.org_type if org else None,
        target_ugt=max(int_levels) if int_levels else None,
        region=org.region if org else None,
    )


async def _candidate_profiles(db: DBSession) -> list[CandidateProfile]:
    """Пул кандидатов: активные пользователи с ролями исполнителя.

    Краткий профиль без контактов и лишнего PII: email/ogrn не читаются и
    не попадают в выдачу; закрытые поля запроса (budget/demand) не участвуют.
    """
    rows = (
        (
            await db.execute(
                select(User)
                .join(user_roles_tbl, user_roles_tbl.c.user_id == User.id)
                .join(Role, Role.id == user_roles_tbl.c.role_id)
                .where(Role.slug.in_(CANDIDATE_POOL_ROLES), User.is_active.is_(True))
                .distinct()
            )
        )
        .scalars()
        .all()
    )
    profiles: list[CandidateProfile] = []
    for user in rows:
        profile = await db.scalar(
            select(UserProfile).where(UserProfile.user_id == user.id)
        )
        org = await db.scalar(
            select(UserOrganization)
            .join(
                OrganizationMember,
                OrganizationMember.organization_id == UserOrganization.id,
            )
            .where(OrganizationMember.user_id == user.id)
            .order_by(OrganizationMember.is_primary.desc(), OrganizationMember.id)
        )
        projects = (
            (
                await db.execute(
                    select(Project)
                    .join(ProjectMember, ProjectMember.project_id == Project.id)
                    .where(ProjectMember.user_id == user.id)
                )
            )
            .scalars()
            .all()
        )
        categories = {p.category for p in projects if p.category}
        if org and org.org_type:
            categories.add(org.org_type)
        levels = {
            int(p.current_level) for p in projects if p.current_level
        } | {
            int(p.preliminary_level) for p in projects if p.preliminary_level
        }
        profiles.append(
            CandidateProfile(
                user_id=user.id,
                full_name=user.full_name,
                roles=tuple(role.slug for role in user.roles),
                headline=profile.headline if profile else None,
                region=profile.region if profile else None,
                competencies=(
                    frozenset(profile.skills or []) if profile else frozenset()
                ),
                categories=frozenset(categories),
                ugt_levels=tuple(sorted(levels)),
                project_count=len(projects),
                organization_name=org.name if org else None,
                organization_type=org.org_type if org else None,
            )
        )
    return profiles


def _summary_out(profile: CandidateProfile) -> CandidateSummaryOut:
    return CandidateSummaryOut(
        candidate_id=profile.user_id,
        full_name=profile.full_name,
        headline=profile.headline,
        region=profile.region,
        organization_name=profile.organization_name,
        organization_type=profile.organization_type,
        participant_types=participant_type_names(profile.roles),
        skills=sorted(profile.competencies),
        categories=sorted(profile.categories),
        ugt_levels=list(profile.ugt_levels),
        project_count=profile.project_count,
    )


@router.get("/{request_id}/candidates")
async def list_candidates(
    request_id: int,
    db: DBSession,
    user: CurrentUser,
    llm: Annotated[LLMClient, Depends(get_ai_ranking_llm_client)],
    ai: bool = Query(False, description="Включить AI-ранжирование beta"),
) -> list[RankedCandidateOut] | AiCandidatesOut:
    """Ранжированные кандидаты для запроса (создатель/staff; чужие → 404).

    Без ?ai=1 — детерминированная базовая выдача БЕЗ LLM (баллы, разбивка,
    объяснения на русском; app/services/matcher.py). Закрытые поля запроса
    (budget/demand) в выдаче не участвуют; профиль кандидата — краткий,
    без контактов и лишнего PII.

    С ?ai=1 — поверх базовой выдачи опциональное AI-ранжирование beta
    (app/services/ai_ranking.py): {base, ai|null, beta, requires_review, note}.
    AI получает только обезличенные поля и возвращает только порядок
    (candidate_id + балл-объяснение); отказ AI (нет ключа/ошибка) → ai=null
    и базовая выдача intact; AI не пишет в БД и не меняет статусы — все
    рекомендации требуют ручной проверки менеджером.
    """
    req = await _require_own_request(db, request_id, user)
    features = await _request_features(db, req)
    profiles = await _candidate_profiles(db)
    ranked = rank(profiles, features)
    base = [
        RankedCandidateOut(
            candidate=_summary_out(entry.candidate),
            score=entry.score.total,
            breakdown=entry.score.breakdown,
            explanation=entry.explanation,
        )
        for entry in ranked
    ]
    if not ai:
        return base
    result = await rank_with_ai(
        profiles,
        features,
        llm,
        request_title=req.title,
        requirements=req.requirements,
    )
    if result is None:
        return AiCandidatesOut(
            base=base,
            ai=None,
            ai_ranked=False,
            note="AI недоступен — базовая выдача",
        )
    return AiCandidatesOut(
        base=base,
        ai=AiRankingOut(
            ranked=[
                AiRankedCandidateOut(
                    candidate_id=item.candidate_id,
                    score=item.score,
                    rationale=item.rationale,
                )
                for item in result.ranked
            ],
            note=result.note,
        ),
        ai_ranked=True,
        note=result.note,
    )


@router.post(
    "/{request_id}/candidates/{candidate_id}/decision",
    response_model=TechRequestCandidateDecisionOut,
    status_code=status.HTTP_201_CREATED,
)
async def decide_candidate(
    request_id: int,
    candidate_id: int,
    payload: TechRequestCandidateDecisionIn,
    db: DBSession,
    user: CurrentUser,
) -> TechRequestCandidateDecisionOut:
    """Решение по кандидату: shortlist/reject + note (создатель/staff).

    Сохраняется в tech_request_candidate_decisions (UNIQUE (request_id,
    candidate_id)); повторное решение → 409 (update не делаем). Исходные
    данные кандидата и запроса не изменяются; аудит tech_request.candidate_decided.
    """
    req = await _require_own_request(db, request_id, user)
    candidate = await db.get(User, candidate_id)
    if candidate is None or not candidate.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Кандидат не найден")
    role_slugs = {role.slug for role in candidate.roles}
    if not role_slugs & CANDIDATE_POOL_ROLES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Кандидат не найден")
    existing = await db.scalar(
        select(TechRequestCandidateDecision).where(
            TechRequestCandidateDecision.request_id == req.id,
            TechRequestCandidateDecision.candidate_id == candidate_id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Решение по этому кандидату уже принято",
        )
    note = payload.note.strip() if payload.note else None
    decision = TechRequestCandidateDecision(
        request_id=req.id,
        candidate_id=candidate_id,
        decision=payload.decision,
        note=note,
        decided_by=user.id,
    )
    db.add(decision)
    await db.flush()
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.candidate_decided",
            details={
                "request_id": req.id,
                "candidate_id": candidate_id,
                "decision": payload.decision,
                "note": note,
                "decided_by": user.id,
            },
        )
    )
    await db.commit()
    await db.refresh(decision)
    return TechRequestCandidateDecisionOut(
        id=decision.id,
        request_id=decision.request_id,
        candidate_id=decision.candidate_id,
        decision=decision.decision,
        note=decision.note,
        decided_by=decision.decided_by,
        created_at=decision.created_at.isoformat() if decision.created_at else None,
    )


# ── Тикет 04: обезличенные офферы, раскрытия, связанный проект ──────────────


async def _offer_out(db: DBSession, offer: TechRequestOffer) -> TechRequestOfferOut:
    """Полная карточка оффера (staff/создатель запроса)."""
    req = await db.get(TechRequest, offer.request_id)
    candidate = await db.get(User, offer.candidate_id)
    return TechRequestOfferOut(
        id=offer.id,
        request_id=offer.request_id,
        request_title=req.title if req else None,
        candidate_id=offer.candidate_id,
        candidate_name=candidate.full_name if candidate else None,
        status=offer.status,
        message=offer.message,
        offered_by=offer.offered_by,
        created_at=offer.created_at.isoformat() if offer.created_at else None,
        responded_at=offer.responded_at.isoformat() if offer.responded_at else None,
    )


async def _offer_request_summary(
    db: DBSession, req: TechRequest
) -> OfferRequestSummaryOut:
    """Обезличенная сводка запроса для кандидата (тикет 04).

    Только отрасль/направление (organization_type), целевой УГТ, регион и
    краткое описание — БЕЗ контактов заказчика и закрытых полей (budget/demand).
    """
    features = await _request_features(db, req)
    return OfferRequestSummaryOut(
        request_id=req.id,
        title=req.title,
        requirements=req.requirements,
        organization_type=features.category,
        target_ugt=features.target_ugt,
        region=features.region,
    )


async def _offer_contacts(db: DBSession, req: TechRequest) -> OfferContactOut:
    """Контакты и полные данные запроса — раскрываются ТОЛЬКО после approved."""
    org = await db.get(UserOrganization, req.organization_id)
    creator = await db.get(User, req.created_by)
    return OfferContactOut(
        organization_name=org.name if org else None,
        region=org.region if org else None,
        creator_full_name=creator.full_name if creator else None,
        creator_email=creator.email if creator else None,
        demand=req.demand,
        budget=float(req.budget) if req.budget is not None else None,
        deadline=req.deadline.isoformat() if req.deadline else None,
    )


async def _disclosure_for_offer(
    db: DBSession, offer_id: int
) -> TechRequestDisclosure | None:
    return await db.scalar(
        select(TechRequestDisclosure).where(TechRequestDisclosure.offer_id == offer_id)
    )


async def _offer_mine_out(
    db: DBSession, offer: TechRequestOffer
) -> OfferMineOut:
    """Карточка оффера для кандидата: обезличенная до approved раскрытия."""
    req = await db.get(TechRequest, offer.request_id)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Предложение не найдено")
    disclosure = await _disclosure_for_offer(db, offer.id)
    contacts: OfferContactOut | None = None
    if disclosure is not None and disclosure.status == "approved":
        contacts = await _offer_contacts(db, req)
    return OfferMineOut(
        id=offer.id,
        request_id=offer.request_id,
        status=offer.status,
        message=offer.message,
        created_at=offer.created_at.isoformat() if offer.created_at else None,
        responded_at=offer.responded_at.isoformat() if offer.responded_at else None,
        disclosure_status=disclosure.status if disclosure else None,
        request=await _offer_request_summary(db, req),
        contacts=contacts,
    )


def _disclosure_out(
    disclosure: TechRequestDisclosure, request_id: int | None
) -> TechRequestDisclosureOut:
    return TechRequestDisclosureOut(
        id=disclosure.id,
        offer_id=disclosure.offer_id,
        request_id=request_id,
        requested_by=disclosure.requested_by,
        status=disclosure.status,
        decided_by=disclosure.decided_by,
        decided_at=disclosure.decided_at.isoformat() if disclosure.decided_at else None,
        reason=disclosure.reason,
        created_at=disclosure.created_at.isoformat() if disclosure.created_at else None,
    )


@router.post(
    "/{request_id}/offers",
    response_model=TechRequestOfferOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_tech_request_offer(
    request_id: int,
    payload: TechRequestOfferIn,
    db: DBSession,
    user: CurrentUser,
) -> TechRequestOfferOut:
    """Обезличенное предложение кандидату (только staff, тикет 04).

    Без контактов заказчика и закрытого содержания; одно предложение на пару
    (request_id, candidate_id) — UNIQUE, повторное → 409. Аудит
    tech_request.offer_created; уведомление кандидату (notify_user).
    """
    if not _is_staff(user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Создавать предложения кандидатам может только сотрудник Центра",
        )
    req = await db.get(TechRequest, request_id)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запрос не найден")
    candidate = await db.get(User, payload.candidate_id)
    if candidate is None or not candidate.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Кандидат не найден")
    role_slugs = {role.slug for role in candidate.roles}
    if not role_slugs & CANDIDATE_POOL_ROLES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Кандидат не найден")
    existing = await db.scalar(
        select(TechRequestOffer).where(
            TechRequestOffer.request_id == req.id,
            TechRequestOffer.candidate_id == payload.candidate_id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Предложение этому кандидату уже отправлено",
        )
    offer = TechRequestOffer(
        request_id=req.id,
        candidate_id=payload.candidate_id,
        status="pending",
        message=payload.message.strip() if payload.message else None,
        offered_by=user.id,
    )
    db.add(offer)
    await db.flush()
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.offer_created",
            details={
                "request_id": req.id,
                "offer_id": offer.id,
                "candidate_id": payload.candidate_id,
                "offered_by": user.id,
            },
        )
    )
    await notify_user(
        db,
        payload.candidate_id,
        "tech_request.offer",
        "Вам направлено обезличенное предложение по технологическому запросу",
        {"offer_id": offer.id, "request_id": req.id},
    )
    await db.commit()
    await db.refresh(offer)
    return await _offer_out(db, offer)


@router.get("/{request_id}/offers", response_model=list[TechRequestOfferOut])
async def list_tech_request_offers(
    request_id: int, db: DBSession, user: CurrentUser
) -> list[TechRequestOfferOut]:
    """Офферы запроса — создателю и Центру (staff); чужие → 404 (IDOR)."""
    await _require_own_request(db, request_id, user)
    rows = (
        (
            await db.execute(
                select(TechRequestOffer)
                .where(TechRequestOffer.request_id == request_id)
                .order_by(TechRequestOffer.id)
            )
        )
        .scalars()
        .all()
    )
    result: list[TechRequestOfferOut] = []
    for offer in rows:
        result.append(await _offer_out(db, offer))
    return result


# ── Лента кандидата и решения по офферу ─────────────────────────────────────


@offers_router.get("/mine", response_model=list[OfferMineOut])
async def my_offers(db: DBSession, user: CurrentUser) -> list[OfferMineOut]:
    """Свои обезличенные предложения (кандидат): только свои, без чужих.

    Контакты/закрытые поля — только после approved раскрытия (contacts).
    """
    rows = (
        (
            await db.execute(
                select(TechRequestOffer)
                .where(TechRequestOffer.candidate_id == user.id)
                .order_by(TechRequestOffer.created_at.desc(), TechRequestOffer.id.desc())
            )
        )
        .scalars()
        .all()
    )
    result: list[OfferMineOut] = []
    for offer in rows:
        result.append(await _offer_mine_out(db, offer))
    return result


@offers_router.get("/{offer_id}", response_model=OfferMineOut)
async def get_offer(offer_id: int, db: DBSession, user: CurrentUser) -> OfferMineOut:
    """Детали оффера: кандидат — свой; создатель/staff — любой; чужой → 404."""
    offer = await db.get(TechRequestOffer, offer_id)
    if offer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Предложение не найдено")
    req = await db.get(TechRequest, offer.request_id)
    is_owner = req is not None and req.created_by == user.id
    if offer.candidate_id != user.id and not is_owner and not _is_staff(user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Предложение не найдено")
    return await _offer_mine_out(db, offer)


async def _require_own_offer(
    db: DBSession, offer_id: int, user: CurrentUser
) -> TechRequestOffer:
    """Оффер доступен кандидату (согласие/отказ); чужие → 404 (IDOR)."""
    offer = await db.get(TechRequestOffer, offer_id)
    if offer is None or offer.candidate_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Предложение не найдено")
    return offer


@offers_router.post("/{offer_id}/accept", response_model=OfferMineOut)
async def accept_offer(
    offer_id: int, db: DBSession, user: CurrentUser
) -> OfferMineOut:
    """Согласие кандидата → accepted + responded_at + запрос раскрытия (pending).

    Аудит tech_request.offer_accepted и tech_request.disclosure_requested;
    уведомление создателю запроса.
    """
    offer = await _require_own_offer(db, offer_id, user)
    if offer.status != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Предложение уже рассмотрено ({offer.status})",
        )
    req = await db.get(TechRequest, offer.request_id)
    now = datetime.now(UTC)
    offer.status = "accepted"
    offer.responded_at = now
    disclosure = TechRequestDisclosure(
        offer_id=offer.id, requested_by=user.id, status="pending"
    )
    db.add(disclosure)
    await db.flush()
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.offer_accepted",
            details={
                "offer_id": offer.id,
                "request_id": offer.request_id,
                "candidate_id": user.id,
                "responded_at": now.isoformat(),
            },
        )
    )
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.disclosure_requested",
            details={
                "disclosure_id": disclosure.id,
                "offer_id": offer.id,
                "request_id": offer.request_id,
                "candidate_id": user.id,
            },
        )
    )
    if req is not None:
        await notify_user(
            db,
            req.created_by,
            "tech_request.disclosure_requested",
            "Кандидат согласился на обезличенное предложение — запрошено "
            "раскрытие контактов",
            {
                "offer_id": offer.id,
                "request_id": offer.request_id,
                "disclosure_id": disclosure.id,
                "candidate_id": user.id,
            },
        )
    await db.commit()
    await db.refresh(offer)
    return await _offer_mine_out(db, offer)


@offers_router.post("/{offer_id}/decline", response_model=OfferMineOut)
async def decline_offer(
    offer_id: int, db: DBSession, user: CurrentUser
) -> OfferMineOut:
    """Отказ кандидата → declined + responded_at (аудит tech_request.offer_declined)."""
    offer = await _require_own_offer(db, offer_id, user)
    if offer.status != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Предложение уже рассмотрено ({offer.status})",
        )
    now = datetime.now(UTC)
    offer.status = "declined"
    offer.responded_at = now
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.offer_declined",
            details={
                "offer_id": offer.id,
                "request_id": offer.request_id,
                "candidate_id": user.id,
                "responded_at": now.isoformat(),
            },
        )
    )
    await db.commit()
    await db.refresh(offer)
    return await _offer_mine_out(db, offer)


# ── Раскрытие контактов: решение staff/создателя запроса ────────────────────


@disclosures_router.post(
    "/{disclosure_id}/decide", response_model=TechRequestDisclosureOut
)
async def decide_disclosure(
    disclosure_id: int,
    payload: TechRequestDisclosureIn,
    db: DBSession,
    user: CurrentUser,
) -> TechRequestDisclosureOut:
    """Решение по раскрытию (staff/создатель запроса; чужие → 404).

    approved → контакты/выбранные поля раскрываются кандидату (аудит
    disclosure_approved + уведомление); denied → причина обязательна
    (аудит disclosure_denied). Повторное решение → 409.
    """
    disclosure = await db.get(TechRequestDisclosure, disclosure_id)
    if disclosure is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Запрос на раскрытие не найден"
        )
    offer = await db.get(TechRequestOffer, disclosure.offer_id)
    req = await db.get(TechRequest, offer.request_id) if offer else None
    is_owner = req is not None and req.created_by == user.id
    if not _is_staff(user) and not is_owner:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Запрос на раскрытие не найден"
        )
    if disclosure.status != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Запрос на раскрытие уже рассмотрен ({disclosure.status})",
        )
    reason = payload.reason.strip() if payload.reason else ""
    if not payload.approve and not reason:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Причина отказа в раскрытии обязательна",
        )
    decision = "approved" if payload.approve else "denied"
    now = datetime.now(UTC)
    disclosure.status = decision
    disclosure.decided_by = user.id
    disclosure.decided_at = now
    disclosure.reason = reason or None
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action=f"tech_request.disclosure_{decision}",
            details={
                "disclosure_id": disclosure.id,
                "offer_id": disclosure.offer_id,
                "request_id": offer.request_id if offer else None,
                "decided_by": user.id,
                "reason": disclosure.reason,
            },
        )
    )
    if offer is not None:
        await notify_user(
            db,
            offer.candidate_id,
            f"tech_request.disclosure_{decision}",
            "Контакты заказчика раскрыты — предложение можно продолжить"
            if payload.approve
            else "В раскрытии контактов отказано",
            {
                "disclosure_id": disclosure.id,
                "offer_id": disclosure.offer_id,
                "request_id": offer.request_id,
                "reason": disclosure.reason,
            },
        )
    await db.commit()
    await db.refresh(disclosure)
    return _disclosure_out(disclosure, offer.request_id if offer else None)


# ── Связанный проект и приглашение кандидата через join-флоу ────────────────


@offers_router.post(
    "/{offer_id}/project",
    response_model=TechRequestProjectOut,
    status_code=status.HTTP_201_CREATED,
)
async def link_offer_project(
    offer_id: int,
    payload: TechRequestProjectIn,
    db: DBSession,
    user: CurrentUser,
) -> TechRequestProjectOut:
    """Связь оффера с проектом (staff/создатель запроса; чужие → 404).

    Новый проект (project_id=None) наследует ТОЛЬКО выбранные поля
    (name/description/category/target_level из title/requirements/org_type/
    target_ugt); существующий — только связь + selected_fields. Приглашение
    кандидата — через существующий join-флоу: join_token проекта + уведомление;
    кандидат вступает через POST /projects/join (auto_accept для staff).
    Аудит tech_request.project_linked.
    """
    offer = await db.get(TechRequestOffer, offer_id)
    if offer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Предложение не найдено")
    req = await db.get(TechRequest, offer.request_id)
    is_owner = req is not None and req.created_by == user.id
    if not _is_staff(user) and not is_owner:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Предложение не найдено")
    if offer.status == "declined":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Кандидат отклонил предложение — связать проект нельзя",
        )
    disclosure = await _disclosure_for_offer(db, offer.id)
    if is_owner and (disclosure is None or disclosure.status != "approved"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Создатель может связать проект только после approved раскрытия",
        )
    invalid = [
        field for field in payload.selected_fields if field not in OFFER_SELECTABLE_FIELDS
    ]
    if invalid:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Недопустимые поля наследования: {', '.join(sorted(invalid))}",
        )
    existing_link = await db.scalar(
        select(TechRequestProject).where(TechRequestProject.offer_id == offer.id)
    )
    if existing_link is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Проект уже связан с этим предложением",
        )
    selected_map: dict[str, str] = {
        field: OFFER_SELECTABLE_FIELD_SOURCES[field]
        for field in payload.selected_fields
    }

    if payload.project_id is None:
        org = await db.get(UserOrganization, req.organization_id) if req else None
        features = await _request_features(db, req) if req else None
        target_ugt = features.target_ugt if features else None
        name = (
            req.title
            if req is not None and "name" in selected_map
            else f"Технологический запрос №{offer.request_id}"
        )
        project = Project(
            name=name,
            description=req.requirements if "description" in selected_map and req else None,
            category=(org.org_type if org else None) if "category" in selected_map else None,
            target_level=target_ugt if "target_level" in selected_map and target_ugt else 9,
            created_by=user.id,
        )
        db.add(project)
        await db.flush()
        primary_role = user.roles[0].slug if user.roles else "participant"
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=user.id,
                role_in_project=primary_role,
                status="active",
                is_priority=True,
            )
        )
        project_id = project.id
        project_created = True
    else:
        project = await db.get(Project, payload.project_id)
        if project is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
        project_id = project.id
        project_created = False

    link = TechRequestProject(
        request_id=offer.request_id,
        offer_id=offer.id,
        project_id=project_id,
        created_by=user.id,
        selected_fields=selected_map,
    )
    db.add(link)
    await db.flush()
    db.add(
        AuditTrailEntry(
            user_id=user.id,
            action="tech_request.project_linked",
            details={
                "offer_id": offer.id,
                "request_id": offer.request_id,
                "project_id": project_id,
                "project_created": project_created,
                "selected_fields": sorted(selected_map),
            },
        )
    )
    await notify_user(
        db,
        offer.candidate_id,
        "tech_request.project_invited",
        "Вас пригласили в проект по технологическому запросу — вступите по "
        "ссылке/токену проекта",
        {
            "project_id": project_id,
            "join_token": project.join_token,
            "shared_by": user.id,
            "offer_id": offer.id,
            "request_id": offer.request_id,
        },
    )
    await db.commit()
    await db.refresh(link)
    return TechRequestProjectOut(
        id=link.id,
        request_id=link.request_id,
        offer_id=link.offer_id,
        project_id=link.project_id,
        project_name=project.name,
        created_by=link.created_by,
        selected_fields=sorted(selected_map),
        created_at=link.created_at.isoformat() if link.created_at else None,
    )
