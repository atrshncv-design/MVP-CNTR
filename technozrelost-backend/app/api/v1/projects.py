from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import Select, and_, func, or_, select

from app.core.deps import (
    CurrentUser,
    CurrentUserOptional,
    DBSession,
    ReadDBSession,
    has_role,
    is_cntr_staff,
)
from app.db.models import (
    AuditTrailEntry,
    ControlPoint,
    Project,
    ProjectDocument,
    ProjectMember,
    PromotionRequest,
    QuestionnaireResult,
    User,
    VerificationDocument,
)
from app.schemas import (
    AuditTrailEntryOut,
    ControlPointDecisionIn,
    ControlPointOut,
    ProjectCreateIn,
    ProjectDetailOut,
    ProjectDocumentOut,
    ProjectMemberOut,
    ProjectOut,
    PublishIn,
    QuestionnaireAnswerIn,
    QuestionnaireResultIn,
    QuestionnaireResultOut,
    RegistryProjectOut,
    VerificationDocIn,
    VerificationDocOut,
)
from app.services.file_storage import FileStorageError, storage

router = APIRouter(prefix="/projects", tags=["projects"])

QUESTIONNAIRE_PASS_THRESHOLD = 70.0

CONTROL_POINTS_TEMPLATE = [
    (
        "КТ-1: Старт проекта",
        "Утверждение концепции, генерация Паспорта и ТЭО, решение аудитора Go/No-Go.",
    ),
    ("КТ-2: Завершение НИР", "Завершение научно-исследовательских работ, верификация УГТ 3."),
    ("КТ-3: Создание прототипа", "Прототип готов к стендовым испытаниям, верификация УГТ 5-6."),
    ("КТ-4: Внедрение", "Технология внедрена, верификация УГТ 8-9, передача в серию."),
]


def compute_current_level(results: list[QuestionnaireAnswerIn]) -> int:
    """Текущий УГТ = максимальный непрерывный уровень с процентом ≥ 70 (как в визарде)."""
    by_level = {r.level_id: r.percentage for r in results}
    level = 0
    for i in range(1, 10):
        if by_level.get(i, 0.0) >= QUESTIONNAIRE_PASS_THRESHOLD:
            level = i
        else:
            break
    return level


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreateIn,
    db: DBSession,
    user: CurrentUser,
) -> ProjectOut:
    project = Project(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        target_level=payload.target_level,
        current_level=compute_current_level(payload.questionnaire_results),
        budget=payload.budget,
        created_by=user.id,
    )
    db.add(project)
    await db.flush()  # нужен project.id для вложенных записей

    # Создатель — приоритетный участник с ролью из своей платформенной роли
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

    for answer in payload.questionnaire_results:
        db.add(
            QuestionnaireResult(
                project_id=project.id,
                user_id=user.id,
                level_id=answer.level_id,
                checked_items={"items": answer.checked_items},
                percentage=answer.percentage,
            )
        )

    # Стандартные контрольные точки проекта (КТ-1 … КТ-4 по методологии)
    for cp_title, cp_desc in CONTROL_POINTS_TEMPLATE:
        db.add(
            ControlPoint(
                project_id=project.id,
                title=cp_title,
                description=cp_desc,
                point_type="gate" if cp_title.startswith("КТ-1") else "milestone",
                status="pending",
            )
        )

    db.add(
        AuditTrailEntry(
            project_id=project.id,
            user_id=user.id,
            action="project.created",
            details={"name": project.name, "target_level": project.target_level},
        )
    )

    await db.commit()
    await db.refresh(project)
    return _project_out(project)


def project_list_stmt(user: CurrentUser) -> Select[tuple[Project]]:
    statement = select(Project).order_by(Project.updated_at.desc(), Project.id.desc())
    if user.is_superuser or is_cntr_staff(user):
        return statement
    joined_projects = select(ProjectMember.project_id).where(
        ProjectMember.user_id == user.id,
        ProjectMember.status == "active",
    )
    return statement.where(
        or_(Project.created_by == user.id, Project.id.in_(joined_projects))
    )


async def get_project_or_404(db: DBSession, project_id: int) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    return project


async def can_access_project(db: DBSession, project: Project, user: CurrentUser) -> bool:
    """Доступ: суперпользователь, персонал ЦНТР, создатель или активный участник.

    Возвращает 404 (а не 403) наружителю, чтобы не раскрывать существование проекта.
    """
    if user.is_superuser or is_cntr_staff(user) or project.created_by == user.id:
        return True
    membership = await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
            ProjectMember.status == "active",
        )
    )
    return membership is not None


async def require_project_access(db: DBSession, project_id: int, user: CurrentUser) -> Project:
    project = await get_project_or_404(db, project_id)
    if not await can_access_project(db, project, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: DBSession, user: CurrentUser) -> list[ProjectOut]:
    result = await db.execute(project_list_stmt(user))
    projects = list(result.scalars().all())
    if not projects:
        return []
    # Один пакетный запрос вместо N+1 (FE-004): control_points для всех проектов разом
    cp_rows = await db.execute(
        select(ControlPoint)
        .where(ControlPoint.project_id.in_([p.id for p in projects]))
        .order_by(ControlPoint.project_id, ControlPoint.id)
    )
    by_project: dict[int, list[ControlPoint]] = {}
    for cp in cp_rows.scalars().all():
        by_project.setdefault(cp.project_id, []).append(cp)
    # Счётчики верифицирующих документов одним запросом (FE-004)
    vd_rows = await db.execute(
        select(VerificationDocument.project_id, func.count(VerificationDocument.id))
        .where(VerificationDocument.project_id.in_([p.id for p in projects]))
        .group_by(VerificationDocument.project_id)
    )
    vd_counts: dict[int, int] = {}
    for pid, cnt in vd_rows.all():
        vd_counts[pid] = cnt
    return [
        _project_out(p, by_project.get(p.id, []), vd_counts.get(p.id, 0))
        for p in projects
    ]


@router.get("/registry", response_model=list[RegistryProjectOut])
async def project_registry(
    db: ReadDBSession,
    user: CurrentUserOptional,
    ugt_min: int | None = Query(None, ge=1, le=9),
    ugt_max: int | None = Query(None, ge=1, le=9),
    category: str | None = Query(None),
    budget_min: float | None = Query(None, ge=0),
    budget_max: float | None = Query(None, ge=0),
    after_id: int | None = Query(None, description="Keyset курсор"),
    limit: int = Query(20, ge=1, le=100, description="Размер страницы"),
) -> list[RegistryProjectOut]:
    """Общий реестр проектов (только is_public). ?ugt_min=7 — реестр технологий."""
    stmt = (
        select(Project, User.organization)
        .outerjoin(User, Project.created_by == User.id)
        .where(Project.is_public.is_(True))
        .order_by(Project.current_level.desc(), Project.updated_at.desc(), Project.id.desc())
    )
    if ugt_min is not None:
        stmt = stmt.where(Project.current_level >= ugt_min)
    if ugt_max is not None:
        stmt = stmt.where(Project.current_level <= ugt_max)
    if category:
        stmt = stmt.where(Project.category == category)
    if budget_min is not None:
        stmt = stmt.where(Project.budget >= budget_min)
    if budget_max is not None:
        stmt = stmt.where(Project.budget <= budget_max)
    # P-08 композитная keyset: (level, updated_at, id) как ORDER BY.
    # Fallback id<after_id если курсор не найден.
    if after_id is not None:
        cursor = await db.get(Project, after_id)
        if cursor is not None:
            stmt = stmt.where(
                or_(
                    Project.current_level < cursor.current_level,
                    and_(
                        Project.current_level == cursor.current_level,
                        Project.updated_at < cursor.updated_at,
                    ),
                    and_(
                        Project.current_level == cursor.current_level,
                        Project.updated_at == cursor.updated_at,
                        Project.id < cursor.id,
                    ),
                )
            )
        else:
            stmt = stmt.where(Project.id < after_id)
    stmt = stmt.limit(limit)

    rows = await db.execute(stmt)
    return [
        RegistryProjectOut(
            id=p.id,
            name=p.name,
            category=p.category,
            current_level=p.current_level,
            preliminary_level=(
                p.preliminary_level if p.show_preliminary else None
            ),
            target_level=p.target_level,
            budget=float(p.budget) if p.budget is not None else None,
            organization=org_name,
            is_public=p.is_public,
            show_preliminary=p.show_preliminary,
            published_at=(
                p.published_at.isoformat() if p.published_at else None
            ),
            created_at=p.created_at.isoformat() if p.created_at else None,
        )
        for p, org_name in rows
    ]


@router.put("/{project_id}/publish", response_model=ProjectOut)
async def publish_project(
    project_id: int,
    payload: PublishIn,
    db: DBSession,
    user: CurrentUser,
) -> ProjectOut:
    """Публикация/скрытие проекта с согласием владельца (тикет 10).

    УГТ 1–2: публикуется после авто-подтверждения (`auto_confirmed`).
    УГТ 3–9: публикуется только после решения менеджера (`approved`).
    """
    project = await require_project_access(db, project_id, user)
    membership = await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id,
            ProjectMember.is_project_admin.is_(True),
        )
    )
    is_staff = is_cntr_staff(user)
    if membership is None and not is_staff and project.created_by != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Публикация доступна только администратору проекта или менеджеру",
        )

    if payload.is_public:
        # Проверка права на публикацию
        if project.status == "auto_confirmed":
            pass  # УГТ 1–2 — после авто-подтверждения
        elif project.status == "approved" and project.current_level >= 2:
            pass  # Повышение УГТ 3–9 — после решения менеджера
        elif project.status == "published" and project.current_level >= 1:
            pass  # После менеджерского апрува драфта (draft→published)
        else:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Публикация требует подтверждения УГТ (авто для 1-2, менеджер для 3-9)",
            )
        project.is_public = True
        project.show_preliminary = payload.show_preliminary
        if project.published_at is None:
            project.published_at = datetime.now(UTC)
    else:
        project.is_public = False
        project.show_preliminary = payload.show_preliminary

    await db.commit()
    await db.refresh(project)
    return _project_out(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int, db: DBSession, user: CurrentUser
) -> None:
    """Удаление только пустого черновика (тикет 13).

    Верифицированный/опубликованный проект удалить нельзя — только архив.
    """
    project = await require_project_access(db, project_id, user)
    if project.created_by != user.id and not is_cntr_staff(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Только владелец")
    has_answers = await db.scalar(
        select(QuestionnaireResult.id).where(
            QuestionnaireResult.project_id == project_id
        ).limit(1)
    )
    has_docs = await db.scalar(
        select(ProjectDocument.id).where(
            ProjectDocument.project_id == project_id
        ).limit(1)
    )
    if has_answers or has_docs or project.status not in ("draft", "auto_confirmed"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Удалить можно только пустой черновик без документов; "
            "верифицированный проект архивируется",
        )
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/archive", response_model=ProjectOut)
async def archive_project(
    project_id: int, db: DBSession, user: CurrentUser
) -> ProjectOut:
    """Архивирование верифицированного проекта (тикет 13)."""
    project = await require_project_access(db, project_id, user)
    if project.created_by != user.id and not is_cntr_staff(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Только владелец")
    if project.status == "archived":
        raise HTTPException(status.HTTP_409_CONFLICT, "Проект уже в архиве")
    project.status = "archived"
    project.is_public = False
    await db.commit()
    await db.refresh(project)
    return _project_out(project)


@router.get("/{project_id}/export")
async def export_project(
    project_id: int, db: DBSession, user: CurrentUser
) -> Response:
    """Экспорт проекта: карточка, решения заявок, заключения (тикет 13).

    Отдаёт JSON-пакет (переносимый) с подтверждёнными данными; файлы
    документов не включаются в публичный экспорт — только метаданные.
    """
    project = await require_project_access(db, project_id, user)
    from fastapi.responses import JSONResponse

    results = (
        (
            await db.execute(
                select(QuestionnaireResult)
                .where(QuestionnaireResult.project_id == project_id)
                .order_by(QuestionnaireResult.level_id)
            )
        )
        .scalars()
        .all()
    )
    requests = (
        (
            await db.execute(
                select(PromotionRequest)
                .where(PromotionRequest.project_id == project_id)
                .order_by(PromotionRequest.attempt_no)
            )
        )
        .scalars()
        .all()
    )
    documents = (
        (
            await db.execute(
                select(ProjectDocument)
                .where(ProjectDocument.project_id == project_id)
                .order_by(ProjectDocument.id)
            )
        )
        .scalars()
        .all()
    )
    payload = {
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "category": project.category,
            "status": project.status,
            "current_level": project.current_level,
            "preliminary_level": project.preliminary_level,
            "target_level": project.target_level,
            "budget": float(project.budget) if project.budget is not None else None,
            "legal_owner": project.legal_owner,
            "rights_holder": project.rights_holder,
            "contract_number": project.contract_number,
            "created_at": project.created_at.isoformat() if project.created_at else None,
        },
        "questionnaire_results": [
            {
                "level_id": r.level_id,
                "percentage": r.percentage,
                "checked_items": r.checked_items,
            }
            for r in results
        ],
        "requests": [
            {
                "id": r.id,
                "from_level": r.from_level,
                "to_level": r.to_level,
                "status": r.status,
                "attempt_no": r.attempt_no,
                "rejection_reason": r.rejection_reason,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in requests
        ],
        "documents": [
            {
                "id": d.id,
                "title": d.title,
                "doc_type": d.doc_type,
                "version": d.version,
                "file_name": d.file_name,
                "mime_type": d.mime_type,
                "file_size": d.file_size,
                "scan_status": d.scan_status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
        "exported_at": datetime.now(UTC).isoformat(),
    }
    return JSONResponse(
        content=payload,
        headers={
            "Content-Disposition": (
                f'attachment; filename="project-{project_id}-export.json"'
            )
        },
    )


@router.get("/{project_id}", response_model=ProjectDetailOut)
async def get_project_detail(
    project_id: int,
    db: DBSession,
    user: CurrentUser,
) -> ProjectDetailOut:
    project = await require_project_access(db, project_id, user)

    # Fetch all related data
    qr_stmt = select(QuestionnaireResult).where(QuestionnaireResult.project_id == project_id)
    qr_result = await db.execute(qr_stmt)
    questionnaire_results = qr_result.scalars().all()

    cp_stmt = select(ControlPoint).where(ControlPoint.project_id == project_id)
    cp_result = await db.execute(cp_stmt)
    control_points = cp_result.scalars().all()

    doc_stmt = select(ProjectDocument).where(ProjectDocument.project_id == project_id)
    doc_result = await db.execute(doc_stmt)
    documents = doc_result.scalars().all()

    vdoc_stmt = select(VerificationDocument).where(
        VerificationDocument.project_id == project_id
    )
    vdoc_result = await db.execute(vdoc_stmt)
    verification_documents = vdoc_result.scalars().all()

    mem_stmt = select(ProjectMember).where(ProjectMember.project_id == project_id)
    mem_result = await db.execute(mem_stmt)
    members = mem_result.scalars().all()

    at_stmt = select(AuditTrailEntry).where(AuditTrailEntry.project_id == project_id)
    at_result = await db.execute(at_stmt)
    audit_trail = at_result.scalars().all()

    # Имена загрузивших одним пакетным запросом (таск 06): раньше db.get(User)
    # на каждый документ — N+1 при длинном списке верифицирующих документов.
    uploader_ids = {v.uploader_id for v in verification_documents if v.uploader_id}
    uploader_names: dict[int, str] = {}
    if uploader_ids:
        name_rows = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(uploader_ids))
        )
        uploader_names = {uid: name for uid, name in name_rows.all()}

    return ProjectDetailOut(
        project=_project_out(project),
        questionnaire_results=[_qr_out(r) for r in questionnaire_results],
        control_points=[_cp_out(cp) for cp in control_points],
        documents=[_doc_out(d) for d in documents],
        verification_documents=[
            _vdoc_out(v, uploader_names.get(v.uploader_id))
            for v in verification_documents
        ],
        members=[_mem_out(m) for m in members],
        audit_trail=[_at_out(a) for a in audit_trail],
    )


@router.post(
    "/questionnaire",
    response_model=QuestionnaireResultOut,
    status_code=status.HTTP_201_CREATED,
)
async def save_questionnaire(
    payload: QuestionnaireResultIn,
    db: DBSession,
    user: CurrentUser,
) -> QuestionnaireResultOut:
    """Сохранение анкеты: per-user (N-16) — каждый участник хранит свои уровни.

    До N-16 запись была общей (UNIQUE project_id+level_id) и любой участник
    перезаписывал проценты всего проекта. После — изолировано по user_id:
    (project_id, level_id, user_id) уникальны, чужие записи не трогаются.
    """
    await require_project_access(db, payload.project_id, user)

    stmt = select(QuestionnaireResult).where(
        QuestionnaireResult.project_id == payload.project_id,
        QuestionnaireResult.level_id == payload.level_id,
        QuestionnaireResult.user_id == user.id,
    )
    existing = await db.scalar(stmt)

    if existing:
        existing.checked_items = {"items": payload.checked_items}
        existing.percentage = payload.percentage
        result = existing
    else:
        result = QuestionnaireResult(
            project_id=payload.project_id,
            user_id=user.id,
            level_id=payload.level_id,
            checked_items={"items": payload.checked_items},
            percentage=payload.percentage,
        )
        db.add(result)

    await db.commit()
    await db.refresh(result)

    return _qr_out(result)


@router.patch("/{project_id}/control-points/{cp_id}", response_model=ControlPointOut)
async def decide_control_point(
    project_id: int,
    cp_id: int,
    payload: ControlPointDecisionIn,
    db: DBSession,
    user: CurrentUser,
) -> ControlPointOut:
    """Решение по контрольной точке: эксперт УГТ (верификация) или аудитор (КТ-1 Go/No-Go)."""
    await get_project_or_404(db, project_id)  # проверка существования проекта
    is_verifier = (
        user.is_superuser
        or is_cntr_staff(user)
        or has_role(user, "regulating_organization", "auditor")
    )
    if not is_verifier:
        # Обычные роли — только участники проекта (иначе 404)
        await require_project_access(db, project_id, user)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Недостаточно прав для решения по КТ")

    cp = await db.get(ControlPoint, cp_id)
    if cp is None or cp.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Контрольная точка не найдена")

    cp.status = payload.status
    cp.decision = payload.decision
    cp.decided_by = user.id

    db.add(
        AuditTrailEntry(
            project_id=project_id,
            user_id=user.id,
            action=f"control_point.{payload.status}",
            details={"cp_id": cp.id, "title": cp.title, "decision": payload.decision},
        )
    )
    await db.commit()
    await db.refresh(cp)
    return _cp_out(cp)


@router.post(
    "/{project_id}/verification-docs",
    response_model=VerificationDocOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_verification_doc(
    project_id: int,
    payload: VerificationDocIn,
    db: DBSession,
    user: CurrentUser,
) -> VerificationDocOut:
    """Верифицирующий документ («подтверждение УГТ»). Доступ — только активному участнику.

    Специальный случай RBAC: до вступления по токену (в т.ч. для регулирующей
    организации) возвращаем 403 с понятным сообщением, а не 404.
    """
    project = await get_project_or_404(db, project_id)
    if not await can_access_project(db, project, user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Сначала присоединитесь к проекту по токену TZ-XXXXXX",
        )
    # N-15: file_ref должен указывать на существующий объект MinIO.
    # file_ref — storage_key вида projects/{id}/...; если указан путь с "/",
    # проверяем наличие объекта в хранилище, иначе 404 (fail-closed).
    # Без "/" — legacy логическая ссылка (например, "ref-1" в тестах) — пропускаем
    # проверку, чтобы не ломать существующие интеграции, но путь с "/" всегда
    # валидируется через storage.get.
    if payload.file_ref and "/" in payload.file_ref:
        exists = await db.scalar(
            select(ProjectDocument.id).where(
                ProjectDocument.project_id == project.id,
                ProjectDocument.storage_key == payload.file_ref,
            )
        )
        if exists is None:
            try:
                # storage.get — синхронный, быстрый (MinIO/локальный tmp)
                storage.get(payload.file_ref)
            except FileStorageError as exc:
                raise HTTPException(
                    status.HTTP_404_NOT_FOUND, "Файл не найден в хранилище"
                ) from exc
    doc = VerificationDocument(
        project_id=project.id,
        uploader_id=user.id,
        title=payload.title,
        comment=payload.comment,
        file_ref=payload.file_ref,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    uploader = await db.get(User, doc.uploader_id)
    return VerificationDocOut(
        id=doc.id,
        project_id=doc.project_id,
        uploader_id=doc.uploader_id,
        uploader_name=uploader.full_name if uploader else None,
        title=doc.title,
        comment=doc.comment,
        file_ref=doc.file_ref,
        created_at=doc.created_at.isoformat() if doc.created_at else None,
    )


def _project_out(
    project: Project,
    control_points: list[ControlPoint] | None = None,
    verification_documents_count: int = 0,
) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        category=project.category,
        target_level=project.target_level,
        current_level=project.current_level,
        status=project.status,
        budget=project.budget,
        join_token=project.join_token,
        created_by=project.created_by,
        legal_owner=project.legal_owner,
        rights_holder=project.rights_holder,
        contract_number=project.contract_number,
        contract_basis=project.contract_basis,
        legal_updated_by=project.legal_updated_by,
        legal_updated_at=project.legal_updated_at.isoformat()
        if project.legal_updated_at
        else None,
        created_at=project.created_at.isoformat() if project.created_at else None,
        updated_at=project.updated_at.isoformat() if project.updated_at else None,
        control_points=[_cp_out(cp) for cp in (control_points or [])],
        verification_documents_count=verification_documents_count,
        is_public=project.is_public,
        show_preliminary=project.show_preliminary,
    )


def _qr_out(r: QuestionnaireResult) -> QuestionnaireResultOut:
    return QuestionnaireResultOut(
        id=r.id,
        project_id=r.project_id,
        level_id=r.level_id,
        checked_items=r.checked_items.get("items", []) if isinstance(r.checked_items, dict) else [],
        percentage=r.percentage,
    )


def _cp_out(cp: ControlPoint) -> ControlPointOut:
    return ControlPointOut(
        id=cp.id,
        project_id=cp.project_id,
        title=cp.title,
        description=cp.description,
        point_type=cp.point_type,
        status=cp.status,
        decision=cp.decision,
        decided_by=cp.decided_by,
    )


def _doc_out(d: ProjectDocument) -> ProjectDocumentOut:
    return ProjectDocumentOut(
        id=d.id,
        project_id=d.project_id,
        title=d.title,
        doc_type=d.doc_type,
        file_url=d.file_url,
        status=d.status,
        version=d.version,
        uploaded_by=d.uploaded_by,
    )


def _vdoc_out(v: VerificationDocument, uploader_name: str | None = None) -> VerificationDocOut:
    return VerificationDocOut(
        id=v.id,
        project_id=v.project_id,
        uploader_id=v.uploader_id,
        uploader_name=uploader_name,
        title=v.title,
        comment=v.comment,
        file_ref=v.file_ref,
        created_at=v.created_at.isoformat() if v.created_at else None,
    )


def _mem_out(m: ProjectMember) -> ProjectMemberOut:
    return ProjectMemberOut(
        id=m.id,
        project_id=m.project_id,
        user_id=m.user_id,
        role_in_project=m.role_in_project,
    )


def _at_out(a: AuditTrailEntry) -> AuditTrailEntryOut:
    return AuditTrailEntryOut(
        id=a.id,
        project_id=a.project_id,
        user_id=a.user_id,
        action=a.action,
        details=a.details if isinstance(a.details, dict) else {},
    )
