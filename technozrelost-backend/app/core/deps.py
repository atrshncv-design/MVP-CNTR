from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_read_db
from app.core.errors import raise_error
from app.core.security import decode_token
from app.db.models import User

bearer_scheme = HTTPBearer(auto_error=False)
DBSession = Annotated[AsyncSession, Depends(get_db)]
# Read-сессия (тикет 18): Replica, если задана DATABASE_REPLICA_URL, иначе Primary.
ReadDBSession = Annotated[AsyncSession, Depends(get_read_db)]


async def get_current_user(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DBSession,
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise raise_error("AUTH_REQUIRED", request=request)
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "access":
            raise ValueError("token type is not access")
        user_id = int(payload["sub"])
    except Exception as exc:  # noqa: BLE001
        raise raise_error("AUTH_INVALID_TOKEN", request=request) from exc
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise raise_error("AUTH_USER_INACTIVE", request=request)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_user_read(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: ReadDBSession,
) -> User:
    """Авторизация для read-эндпоинтов (реестры/витрины) на той же read-сессии.

    Почему отдельная функция, а не get_current_user: FastAPI кэширует
    зависимости по вызываемому объекту. get_current_user зависит от get_db
    (Primary), а read-эндпоинт — от get_read_db: кэш не совпадает и запрос
    открывает 2 сессии/2 соединения из пула (при prod без реплики — из
    одного и того же пула Primary). Аутентифицированный GET /projects/registry
    держал 2 коннекта весь запрос: 50 concurrent требовали 100 при пуле 30 —
    QueuePool timeout. Эта функция зависит от get_read_db, поэтому делит
    одну сессию с db эндпоинта (1 соединение на запрос).
    """
    if creds is None or creds.scheme.lower() != "bearer":
        raise raise_error("AUTH_REQUIRED", request=request)
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "access":
            raise ValueError("token type is not access")
        user_id = int(payload["sub"])
    except Exception as exc:  # noqa: BLE001
        raise raise_error("AUTH_INVALID_TOKEN", request=request) from exc
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise raise_error("AUTH_USER_INACTIVE", request=request)
    return user


ReadCurrentUser = Annotated[User, Depends(get_current_user_read)]


async def get_current_user_optional(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DBSession,
) -> User | None:
    """Токен опционален: публичные эндпоинты (реестры) работают без авторизации."""
    if creds is None or creds.scheme.lower() != "bearer":
        return None
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "access":
            return None
        user_id = int(payload["sub"])
        user = await db.get(User, user_id)
        if user is None or not user.is_active:
            return None
        return user
    except Exception:  # noqa: BLE001 — невалидный токен = аноним
        return None


CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]


async def get_current_user_optional_read(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: ReadDBSession,
) -> User | None:
    """Опциональная авторизация для read-эндпоинтов на той же read-сессии.

    Та же причина, что у get_current_user_read: делит одну сессию с db
    эндпоинта через кэш get_read_db (1 соединение на запрос вместо 2).
    Публичные реестры работают без авторизации; невалидный токен = аноним.
    """
    if creds is None or creds.scheme.lower() != "bearer":
        return None
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "access":
            return None
        user_id = int(payload["sub"])
        user = await db.get(User, user_id)
        if user is None or not user.is_active:
            return None
        return user
    except Exception:  # noqa: BLE001 — невалидный токен = аноним
        return None


ReadCurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional_read)]


def require_role(*slugs: str) -> Any:
    allowed = set(slugs)

    async def _checker(user: CurrentUser, request: Request) -> User:
        user_slugs = {r.slug for r in user.roles}
        if user_slugs & allowed or user.is_superuser:
            return user
        raise raise_error("AUTH_FORBIDDEN", request=request)

    return _checker


def has_role(user: User, *slugs: str) -> bool:
    """True, если у пользователя есть хотя бы одна из ролей (или он суперпользователь)."""
    if user.is_superuser:
        return True
    user_slugs = {r.slug for r in user.roles}
    return bool(user_slugs & set(slugs))


CNTR_STAFF_SLUGS = ("cntr_admin", "cntr_manager")

# R04i (таск 03): закрытая выдача привилегий — явный allowlist саморегистрации.
# Почему allowlist, а не ban-list: запрет «кроме staff» уже пропустил auditor
# один раз (история 6, Решение §3). Привилегии выдаёт только администратор
# через PATCH /users/{id}; миграция 0033 отзывает ранее самозарегистрированные.
# ugt_expert — до-переименованный slug regulating_organization (миграция 0010):
# оставлен привилегированным, чтобы старое значение не открыло лазейку.
PRIVILEGED_ROLE_SLUGS: tuple[str, ...] = (
    "auditor",
    "regulating_organization",
    "ugt_expert",
    "investor",
    "cntr_admin",
    "cntr_manager",
)
SELF_REGISTER_ALLOWED_SLUGS: frozenset[str] = frozenset(
    {
        "gk_customer",
        "rd_executor",
        "scientific_org",
        "serial_manufacturer",
    }
)


def is_cntr_staff(user: User) -> bool:
    return has_role(user, *CNTR_STAFF_SLUGS)
