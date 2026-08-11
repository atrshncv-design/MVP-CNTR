"""Каталог мер поддержки (тикет 04 operations-modules): программы, checklist, прогресс.

RBAC (зафиксировано):
* Создание/редактирование/публикация/подтверждение/удаление — только служебная
  роль cntr_admin/cntr_manager (или суперпользователь), иначе 403.
* Публикация требует actuality_date (иначе 422); подтверждение — только после
  публикации (409).
* GET /support-programs — ПУБЛИЧНЫЙ список без авторизации: только
  опубликованные/подтверждённые; фильтры: категория (JSONB-содержимость),
  УГТ-диапазон (пересечение, NULL-границы открыты).
* GET /{id} — детали только авторизованным (401 анониму); staff видит и
  черновики, остальные — только опубликованные/подтверждённые; чужое/невидимое
  → 404 (IDOR не раскрывает существование).
* Прогресс checklist — только свой (GET/POST /{id}/checklist/progress):
  сохраняется локально, наружу НЕ отправляется (внешних вызовов нет).
* «Устарело»/рекомендация — детерминированные производные (services/
  support_catalog.py, без LLM), вычисляются при каждом чтении.
* Аудит: support_program.created/updated/published/confirmed/deleted,
  checklist_progress.updated.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import delete, select

from app.core.deps import CurrentUser, CurrentUserOptional, DBSession, is_cntr_staff
from app.db.models import (
    AuditTrailEntry,
    SupportProgram,
    SupportProgramChecklist,
    SupportProgramChecklistProgress,
    UserOrganization,
)
from app.schemas import (
    SupportProgramIn,
    SupportProgramOut,
    SupportProgramProgressIn,
    SupportProgramProgressOut,
    SupportProgramUpdateIn,
)
from app.services.support_catalog import STALE_MESSAGE, compute_actuality

router = APIRouter(prefix="/support-programs", tags=["support-programs"])

PUBLIC_STATUSES = ("published", "confirmed")


def _fmt_date(value) -> str | None:
    return value.isoformat() if value is not None else None


def _fmt_dt(value) -> str | None:
    return value.isoformat() if value is not None else None


def _is_staff(user) -> bool:
    return user.is_superuser or is_cntr_staff(user)


def _require_staff(user) -> None:
    if not _is_staff(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Недостаточно прав")


async def _audit(db: DBSession, *, user_id: int, action: str, details: dict) -> None:
    db.add(
        AuditTrailEntry(
            project_id=None, user_id=user_id, action=action, details=details
        )
    )


def _actuality_payload(program: SupportProgram) -> dict:
    is_stale, recommendation = compute_actuality(program.actuality_date)
    payload: dict = {
        "is_stale": is_stale,
        "recommendation": recommendation,
    }
    if is_stale:
        payload["stale_message"] = STALE_MESSAGE
    return payload


def _program_payload(
    program: SupportProgram,
    *,
    checklist: list[dict] | None = None,
    progress: dict | None = None,
) -> dict:
    return {
        "id": program.id,
        "title": program.title,
        "source_url": program.source_url,
        "source_name": program.source_name,
        "actuality_date": _fmt_date(program.actuality_date),
        "responsible_org_id": program.responsible_org_id,
        "target_ugt_min": program.target_ugt_min,
        "target_ugt_max": program.target_ugt_max,
        "categories": program.categories or [],
        "eligibility": program.eligibility,
        "status": program.status,
        "published_at": _fmt_dt(program.published_at),
        "checklist": checklist or [],
        "progress": progress,
        **_actuality_payload(program),
    }


async def _checklist_out(db: DBSession, program_id: int) -> list[dict]:
    rows = (
        await db.execute(
            select(SupportProgramChecklist)
            .where(SupportProgramChecklist.program_id == program_id)
            .order_by(SupportProgramChecklist.position)
        )
    ).scalars().all()
    return [{"position": c.position, "item": c.item} for c in rows]


async def _progress_out(
    db: DBSession, program_id: int, user_id: int
) -> dict | None:
    row = await db.scalar(
        select(SupportProgramChecklistProgress).where(
            SupportProgramChecklistProgress.program_id == program_id,
            SupportProgramChecklistProgress.user_id == user_id,
        )
    )
    if row is None:
        return None
    return {
        "program_id": row.program_id,
        "completed": row.completed or [],
        "updated_at": _fmt_dt(row.updated_at),
    }


async def _replace_checklist(
    db: DBSession, program_id: int, items: list[str]
) -> None:
    """Замена позиций checklist программы списком (position = индекс)."""
    await db.execute(
        delete(SupportProgramChecklist).where(
            SupportProgramChecklist.program_id == program_id
        )
    )
    for position, item in enumerate(items):
        db.add(
            SupportProgramChecklist(
                program_id=program_id, item=item, position=position
            )
        )


async def _get_visible_program(
    db: DBSession, program_id: int, user, *, staff_sees_drafts: bool
) -> SupportProgram:
    program = await db.get(SupportProgram, program_id)
    if program is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Программа не найдена")
    if _is_staff(user) and staff_sees_drafts:
        return program
    if program.status not in PUBLIC_STATUSES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Программа не найдена")
    return program


async def _require_published(db: DBSession, program_id: int) -> SupportProgram:
    """Публичная видимость для прогресса/деталей: опубликованные/подтверждённые."""
    program = await db.get(SupportProgram, program_id)
    if program is None or program.status not in PUBLIC_STATUSES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Программа не найдена")
    return program


async def _validate_org(db: DBSession, org_id: int | None) -> None:
    if org_id is None:
        return
    org = await db.get(UserOrganization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")


# ─── CRUD программ ───────────────────────────────────────────────────────────

@router.post("", response_model=SupportProgramOut, status_code=status.HTTP_201_CREATED)
async def create_support_program(
    payload: SupportProgramIn, db: DBSession, user: CurrentUser
) -> SupportProgramOut:
    _require_staff(user)
    await _validate_org(db, payload.responsible_org_id)
    program = SupportProgram(
        title=payload.title,
        source_url=payload.source_url,
        source_name=payload.source_name,
        actuality_date=payload.actuality_date,
        responsible_org_id=payload.responsible_org_id,
        target_ugt_min=payload.target_ugt_min,
        target_ugt_max=payload.target_ugt_max,
        categories=payload.categories,
        eligibility=payload.eligibility,
        status="draft",
        created_by=user.id,
    )
    db.add(program)
    await db.flush()
    await _replace_checklist(db, program.id, payload.checklist)
    await _audit(
        db,
        user_id=user.id,
        action="support_program.created",
        details={"support_program_id": program.id, "title": program.title},
    )
    await db.commit()
    await db.refresh(program)
    checklist = await _checklist_out(db, program.id)
    return SupportProgramOut(**_program_payload(program, checklist=checklist))


@router.get("", response_model=list[SupportProgramOut])
async def list_support_programs(
    db: DBSession,
    _user: CurrentUserOptional,
    category: str | None = None,
    ugt_min: int | None = None,
    ugt_max: int | None = None,
) -> list[SupportProgramOut]:
    """Публичный список: только опубликованные/подтверждённые.

    Фильтры: category — категория, входящая в categories программы
    (JSONB-содержимость); ugt_min/ugt_max — пересечение УГТ-диапазонов
    (NULL-границы программы трактуются как открытые).
    """
    statement = (
        select(SupportProgram)
        .where(SupportProgram.status.in_(PUBLIC_STATUSES))
        .order_by(SupportProgram.published_at.desc(), SupportProgram.id.desc())
    )
    if category:
        statement = statement.where(SupportProgram.categories.contains([category]))
    if ugt_min is not None:
        statement = statement.where(
            SupportProgram.target_ugt_max.is_(None)
            | (SupportProgram.target_ugt_max >= ugt_min)
        )
    if ugt_max is not None:
        statement = statement.where(
            SupportProgram.target_ugt_min.is_(None)
            | (SupportProgram.target_ugt_min <= ugt_max)
        )
    programs = (await db.execute(statement)).scalars().all()
    return [SupportProgramOut(**_program_payload(p)) for p in programs]


@router.get("/{program_id}", response_model=SupportProgramOut)
async def get_support_program(
    program_id: int, db: DBSession, user: CurrentUser
) -> SupportProgramOut:
    """Детали + checklist + свой прогресс. Аноним → 401; невидимое → 404."""
    program = await _get_visible_program(
        db, program_id, user, staff_sees_drafts=True
    )
    checklist = await _checklist_out(db, program.id)
    progress = await _progress_out(db, program.id, user.id)
    return SupportProgramOut(
        **_program_payload(program, checklist=checklist, progress=progress)
    )


@router.patch("/{program_id}", response_model=SupportProgramOut)
async def update_support_program(
    program_id: int,
    payload: SupportProgramUpdateIn,
    db: DBSession,
    user: CurrentUser,
) -> SupportProgramOut:
    _require_staff(user)
    program = await db.get(SupportProgram, program_id)
    if program is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Программа не найдена")
    await _validate_org(db, payload.responsible_org_id)

    changes: list[str] = []
    for field in (
        "title",
        "source_url",
        "source_name",
        "actuality_date",
        "responsible_org_id",
        "target_ugt_min",
        "target_ugt_max",
        "eligibility",
    ):
        value = getattr(payload, field)
        if value is not None:
            setattr(program, field, value)
            changes.append(field)
    if payload.categories is not None:
        program.categories = payload.categories
        changes.append("categories")
    if payload.checklist is not None:
        await _replace_checklist(db, program.id, payload.checklist)
        changes.append("checklist")

    await _audit(
        db,
        user_id=user.id,
        action="support_program.updated",
        details={"support_program_id": program.id, "changed": changes},
    )
    await db.commit()
    await db.refresh(program)
    checklist = await _checklist_out(db, program.id)
    progress = await _progress_out(db, program.id, user.id)
    return SupportProgramOut(
        **_program_payload(program, checklist=checklist, progress=progress)
    )


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_support_program(
    program_id: int, db: DBSession, user: CurrentUser
) -> Response:
    _require_staff(user)
    program = await db.get(SupportProgram, program_id)
    if program is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Программа не найдена")
    await _audit(
        db,
        user_id=user.id,
        action="support_program.deleted",
        details={"support_program_id": program.id, "title": program.title},
    )
    await db.delete(program)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Публикация / подтверждение ──────────────────────────────────────────────

@router.post("/{program_id}/publish", response_model=SupportProgramOut)
async def publish_support_program(
    program_id: int, db: DBSession, user: CurrentUser
) -> SupportProgramOut:
    """Публикация: только staff; требует actuality_date (иначе 422)."""
    _require_staff(user)
    program = await db.get(SupportProgram, program_id)
    if program is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Программа не найдена")
    if program.status != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Программа уже опубликована или подтверждена"
        )
    if program.actuality_date is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Для публикации необходима дата актуальности (actuality_date)",
        )
    program.status = "published"
    program.published_by = user.id
    program.published_at = datetime.now()
    await _audit(
        db,
        user_id=user.id,
        action="support_program.published",
        details={
            "support_program_id": program.id,
            "actuality_date": _fmt_date(program.actuality_date),
        },
    )
    await db.commit()
    await db.refresh(program)
    checklist = await _checklist_out(db, program.id)
    return SupportProgramOut(**_program_payload(program, checklist=checklist))


@router.post("/{program_id}/confirm", response_model=SupportProgramOut)
async def confirm_support_program(
    program_id: int, db: DBSession, user: CurrentUser
) -> SupportProgramOut:
    """Подтверждение: только staff; только после публикации (иначе 409)."""
    _require_staff(user)
    program = await db.get(SupportProgram, program_id)
    if program is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Программа не найдена")
    if program.status != "published":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Подтвердить можно только опубликованную программу",
        )
    program.status = "confirmed"
    await _audit(
        db,
        user_id=user.id,
        action="support_program.confirmed",
        details={"support_program_id": program.id},
    )
    await db.commit()
    await db.refresh(program)
    checklist = await _checklist_out(db, program.id)
    return SupportProgramOut(**_program_payload(program, checklist=checklist))


# ─── Checklist-прогресс (только свой; наружу НЕ отправляется) ───────────────

@router.get(
    "/{program_id}/checklist/progress", response_model=SupportProgramProgressOut
)
async def get_my_progress(
    program_id: int, db: DBSession, user: CurrentUser
) -> SupportProgramProgressOut:
    """Свой прогресс по программе. Чужой прогресс недоступен (404 на невидимое)."""
    program = await _get_visible_program(
        db, program_id, user, staff_sees_drafts=True
    )
    progress = await _progress_out(db, program.id, user.id)
    if progress is None:
        return SupportProgramProgressOut(program_id=program.id, completed=[])
    return SupportProgramProgressOut(**progress)


@router.post(
    "/{program_id}/checklist/progress", response_model=SupportProgramProgressOut
)
async def save_my_progress(
    program_id: int,
    payload: SupportProgramProgressIn,
    db: DBSession,
    user: CurrentUser,
) -> SupportProgramProgressOut:
    """Сохранение прогресса (completed — массив позиций). Только локально."""
    program = await _get_visible_program(
        db, program_id, user, staff_sees_drafts=True
    )
    checklist = await _checklist_out(db, program.id)
    max_position = len(checklist) - 1
    for position in payload.completed:
        if position < 0 or position > max_position:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Недопустимая позиция checklist: {position}",
            )

    row = await db.scalar(
        select(SupportProgramChecklistProgress).where(
            SupportProgramChecklistProgress.program_id == program.id,
            SupportProgramChecklistProgress.user_id == user.id,
        )
    )
    if row is None:
        row = SupportProgramChecklistProgress(
            program_id=program.id, user_id=user.id, completed=payload.completed
        )
        db.add(row)
    else:
        row.completed = payload.completed
        row.updated_at = datetime.now()
    await db.flush()
    await _audit(
        db,
        user_id=user.id,
        action="checklist_progress.updated",
        details={"support_program_id": program.id, "completed": payload.completed},
    )
    await db.commit()
    await db.refresh(row)
    return SupportProgramProgressOut(
        program_id=row.program_id,
        completed=row.completed or [],
        updated_at=_fmt_dt(row.updated_at),
    )
