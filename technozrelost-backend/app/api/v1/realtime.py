"""Realtime-уведомления и распределение задач (тикет 12).

- GET /api/v1/notifications/stream — SSE: события доставляются live,
  уведомления сохраняются в БД и не теряются при закрытом браузере.
  Snapshot без удержания Session (N-03): непрочитанный счётчик берётся
  короткой сессией до старта стрима, далее — Redis pubsub (две реплики
  видят события), fallback — in-memory queue.
- GET /api/v1/manager/tasks — очередь общих задач (менеджеры).
- POST /api/v1/manager/tasks/{id}/claim — атомарное взятие задачи.
- POST /api/v1/manager/tasks/{id}/reassign — переназначение (админ).
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, text

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.deps import CurrentUser, DBSession, has_role, require_role
from app.db.models import Notification, NotificationOutbox, User
from app.schemas import ManagerTaskOut
from app.services.notifications import claim_next_task, notify_managers

router = APIRouter(tags=["notifications"])

ManagerOnly = require_role("cntr_manager", "cntr_admin")

# Fallback in-memory pubsub, когда Redis недоступен (тесты, локальный запуск)
_fallback_queues: dict[int, set[asyncio.Queue[dict[str, Any]]]] = {}


def _is_manager(user: CurrentUser) -> bool:
    return has_role(user, "cntr_manager", "cntr_admin")


def _get_redis_async() -> Any | None:
    url = settings.redis_url
    if not url:
        return None
    try:
        import redis.asyncio as redis_async

        return redis_async.from_url(
            url, socket_connect_timeout=1, socket_timeout=1, decode_responses=True
        )
    except Exception:  # noqa: BLE001
        return None


async def _publish_stream(user_ids: list[int], event: dict[str, Any]) -> None:
    """Рассылает событие подключённым пользователям (best-effort).

    При наличии REDIS_URL — через Redis pubsub (p95 500мс, 2 реплики
    видят события). Иначе — fallback в _fallback_queues (один процесс).
    """
    # Redis pubsub (N-03)
    client = _get_redis_async()
    if client is not None:
        try:
            payload = json.dumps(event, ensure_ascii=False)
            for uid in user_ids:
                await client.publish(f"realtime:{uid}", payload)
            # не закрываем клиент — from_url кэширует пул
            return
        except Exception:  # noqa: BLE001 — fallback
            pass
    # Fallback in-memory (тесты без Redis)
    for uid in user_ids:
        for queue in list(_fallback_queues.get(uid, set())):
            try:
                queue.put_nowait(event)
            except Exception:  # noqa: BLE001 — очередь переполнена/закрыта
                _fallback_queues.get(uid, set()).discard(queue)


@router.get("/notifications/stream")
async def stream_notifications(
    request: Request,
    access_token: str | None = None,
) -> StreamingResponse:
    """SSE-поток событий. Соединение держится, события доставляются live.

    Snapshot берётся короткой сессией до старта стрима (N-03: не держит
    Session во время keep-alive). EventSource не поддерживает заголовки —
    токен принимается query-параметром (access_token) или Bearer-заголовком
    и валидируется тем же механизмом, что и CurrentUser.
    """
    # резолв uid из query или Authorization
    token: str | None = access_token
    if token is None:
        auth = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth[7:].strip()
    uid: int | None = None
    if token:
        from app.core.security import decode_token

        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                raise ValueError("token type is not access")
            uid = int(payload["sub"])
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невалидный токен") from exc
        # проверка активности короткой сессией (не держим Session)
    try:
        async with SessionLocal() as tmp:
            active = await tmp.get(User, uid)
            if active is None or not active.is_active:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь неактивен")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь неактивен") from exc

    assert uid is not None  # для mypy: после проверки токена uid определён
    # snapshot непрочитанных — короткая сессия, не держим соединение (N-03)
    try:
        async with SessionLocal() as tmp:
            unread = await tmp.scalar(
                select(func.count(Notification.id)).where(
                    Notification.user_id == uid, Notification.is_read.is_(False)
                )
            )
    except Exception:
        unread = 0
    snapshot_unread = int(unread or 0)

    async def event_source() -> AsyncIterator[str]:
        # Redis pubsub предпочтительно (две реплики)
        rclient = _get_redis_async()
        if rclient is not None:
            pubsub = rclient.pubsub()
            channel = f"realtime:{uid}"
            try:
                await pubsub.subscribe(channel)
            except Exception:  # noqa: BLE001 — fallback
                pubsub = None
            if pubsub is not None:
                try:
                    yield f"event: snapshot\ndata: {json.dumps({'unread': snapshot_unread})}\n\n"
                    while True:
                        # timeout 20s → keep-alive, как в исходном коде
                        msg: Any | None = None
                        try:
                            msg = await pubsub.get_message(
                                ignore_subscribe_messages=True, timeout=20.0
                            )
                        except Exception:  # noqa: BLE001
                            msg = None
                        if msg is None:
                            yield ": keep-alive\n\n"
                            continue
                        if msg.get("type") != "message":
                            continue
                        data = msg.get("data")
                        if isinstance(data, bytes):
                            data = data.decode()
                        try:
                            event = json.loads(data) if isinstance(data, str) else {}
                        except Exception:  # noqa: BLE001
                            event = {"raw": data}
                        evt = json.dumps(event, ensure_ascii=False)
                        yield f"event: notification\ndata: {evt}\n\n"
                finally:
                    try:
                        await pubsub.unsubscribe(channel)
                        await pubsub.close()
                    except Exception:  # noqa: BLE001
                        pass
                return
        # fallback in-memory queue (тесты без Redis)
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        _fallback_queues.setdefault(uid, set()).add(queue)
        try:
            yield f"event: snapshot\ndata: {json.dumps({'unread': snapshot_unread})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=20.0)
                except TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                yield f"event: notification\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
        finally:
            _fallback_queues.setdefault(uid, set()).discard(queue)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/notifications/emit", status_code=status.HTTP_201_CREATED)
async def emit_event(
    db: DBSession,
    user: CurrentUser,
    type: str = "general",
    title: str = "Событие",
    project_id: int | None = None,
) -> dict[str, Any]:
    """Тестовый/внутренний эмиттер события (менеджеры и админы).

    Проектные события эмитятся бизнес-логикой (заявки, решения); этот
    эндпоинт позволяет проверить realtime-доставку и outbox.
    """
    if not _is_manager(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Только менеджеры")
    entry = await notify_managers(db, type, title, {"project_id": project_id})
    await db.commit()
    # best-effort realtime: подписанным менеджерам
    manager_ids = (
        (
            await db.execute(
                text(
                    "SELECT DISTINCT u.id FROM users u "
                    "JOIN user_roles ur ON ur.user_id = u.id "
                    "JOIN roles r ON r.id = ur.role_id "
                    "WHERE r.slug IN ('cntr_manager', 'cntr_admin')"
                )
            )
        )
        .scalars()
        .all()
    )
    await _publish_stream(
        [int(m) for m in manager_ids],
        {"id": entry.id, "type": type, "title": title, "project_id": project_id},
    )
    return {"id": entry.id, "status": entry.status}


# ── Очередь задач менеджера ─────────────────────────────────────────────────


@router.get("/manager/tasks", response_model=list[ManagerTaskOut])
async def manager_tasks(
    db: DBSession, user: CurrentUser, status_filter: str | None = None
) -> list[ManagerTaskOut]:
    """Очередь общих задач: pending (неназначенные) и claimed (взятые)."""
    await ManagerOnly(user)
    stmt = (
        select(NotificationOutbox, User.full_name)
        .outerjoin(User, NotificationOutbox.manager_id == User.id)
        .where(NotificationOutbox.target_scope == "general")
        .order_by(NotificationOutbox.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(NotificationOutbox.status == status_filter)
    rows = await db.execute(stmt)
    return [
        ManagerTaskOut(
            id=entry.id,
            type=entry.payload.get("type", "general"),
            title=entry.payload.get("title", ""),
            status=entry.status,
            manager_name=manager_name,
            project_id=entry.payload.get("project_id"),
            created_at=entry.created_at.isoformat() if entry.created_at else None,
        )
        for entry, manager_name in rows
    ]


@router.post("/manager/tasks/{task_id}/claim", response_model=ManagerTaskOut)
async def claim_task(
    task_id: int, db: DBSession, user: CurrentUser
) -> ManagerTaskOut:
    """Атомарное взятие неназначенной задачи (FOR UPDATE SKIP LOCKED)."""
    await ManagerOnly(user)
    entry = await claim_next_task(db, user.id)
    if entry is None or entry.id != task_id:
        # конкретная задача уже взята или не найдена
        existing = await db.scalar(
            select(NotificationOutbox).where(NotificationOutbox.id == task_id)
        )
        if existing is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Задача не найдена")
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Задача уже взята другим менеджером",
        )
    await db.commit()
    manager = await db.get(User, user.id)
    return ManagerTaskOut(
        id=entry.id,
        type=entry.payload.get("type", "general"),
        title=entry.payload.get("title", ""),
        status=entry.status,
        manager_name=manager.full_name if manager else None,
        project_id=entry.payload.get("project_id"),
        created_at=entry.created_at.isoformat() if entry.created_at else None,
    )


@router.post("/manager/tasks/{task_id}/reassign", response_model=ManagerTaskOut)
async def reassign_task(
    task_id: int, db: DBSession, user: CurrentUser, manager_id: int
) -> ManagerTaskOut:
    """Переназначение задачи администратором."""
    await require_role("cntr_admin")(user)
    entry = await db.get(NotificationOutbox, task_id)
    if entry is None or entry.target_scope != "general":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Задача не найдена")
    target = await db.get(User, manager_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Менеджер не найден")
    entry.manager_id = manager_id
    entry.status = "claimed"
    await db.commit()
    await db.refresh(entry)
    manager = await db.get(User, manager_id)
    return ManagerTaskOut(
        id=entry.id,
        type=entry.payload.get("type", "general"),
        title=entry.payload.get("title", ""),
        status=entry.status,
        manager_name=manager.full_name if manager else None,
        project_id=entry.payload.get("project_id"),
        created_at=entry.created_at.isoformat() if entry.created_at else None,
    )
