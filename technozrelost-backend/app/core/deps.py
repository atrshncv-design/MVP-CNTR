from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, get_read_db
from app.core.security import decode_token
from app.db.models import MfaCredential, User

bearer_scheme = HTTPBearer(auto_error=False)
DBSession = Annotated[AsyncSession, Depends(get_db)]
# Read-сессия (тикет 18): Replica, если задана DATABASE_REPLICA_URL, иначе Primary.
ReadDBSession = Annotated[AsyncSession, Depends(get_read_db)]


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DBSession,
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Не авторизован")
    try:
        payload = decode_token(creds.credentials)
        if payload.get("type") != "access":
            raise ValueError("token type is not access")
        user_id = int(payload["sub"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невалидный токен") from exc
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь неактивен")
    if user.status in ("blocked", "deleted"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт заблокирован")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_verified_user(user: CurrentUser) -> User:
    """Чувствительные операции доступны только после подтверждения email (тикет 01)."""
    if user.status != "verified":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Подтвердите email для выполнения этого действия"
        )
    return user


VerifiedUser = Annotated[User, Depends(require_verified_user)]


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


def require_role(*slugs: str) -> Any:
    allowed = set(slugs)

    async def _checker(user: CurrentUser) -> User:
        user_slugs = {r.slug for r in user.roles}
        if user_slugs & allowed or user.is_superuser:
            return user
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Недостаточно прав")

    return _checker


def require_verified_role(*slugs: str) -> Any:
    """Роль + подтверждённый email: служебные действия (тикет 01)."""

    async def _checker(user: CurrentUser) -> User:
        if user.status != "verified":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Подтвердите email для выполнения этого действия"
            )
        user_slugs = {r.slug for r in user.roles}
        if user_slugs & set(slugs) or user.is_superuser:
            return user
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Недостаточно прав")

    return _checker


def has_role(user: User, *slugs: str) -> bool:
    """True, если у пользователя есть хотя бы одна из ролей (или он суперпользователь)."""
    if user.is_superuser:
        return True
    user_slugs = {r.slug for r in user.roles}
    return bool(user_slugs & set(slugs))


CNTR_STAFF_SLUGS = ("cntr_admin", "cntr_manager")


def is_cntr_staff(user: User) -> bool:
    return has_role(user, *CNTR_STAFF_SLUGS)


async def require_staff_mfa(user: CurrentUser, db: DBSession) -> User:
    """MFA-гейт защищённого служебного кабинета (тикет 02).

    Служебный пользователь (cntr_admin/cntr_manager или superuser) без
    завершённой MFA (enabled) не входит в кабинет — 403 «требуется MFA».

    Решение по тестам (задокументировано): в APP_ENV=test гейт НЕ применяется —
    существующие фикстуры входят без MFA-флоу; прод-контур (dev/prod/…) строгий
    и НЕ ослабляется. Полный MFA-цикл и сам гейт покрыты tests/test_mfa.py
    (гейт проверяется принудительным переводом settings.app_env в dev).
    """
    if not (is_cntr_staff(user) or user.is_superuser):
        return user
    cred = await db.scalar(
        select(MfaCredential).where(MfaCredential.user_id == user.id)
    )
    if cred is not None and cred.enabled:
        return user
    if settings.app_env == "test":
        return user
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        "Требуется MFA: завершите настройку двухфакторной аутентификации",
    )


StaffMFARequired = Annotated[User, Depends(require_staff_mfa)]


async def require_admin_with_mfa(user: CurrentUser, db: DBSession) -> User:
    """Композиция роль-проверки и MFA-гейта для администратора ЦНТР.

    Два отдельных `Depends(...)` в одном `Annotated` в текущей версии FastAPI
    не применяются оба (действует только последний) — поэтому роль и MFA
    проверяются одной зависимостью (тикет 02 identity-organizations).
    """
    await require_role("cntr_admin")(user)
    return await require_staff_mfa(user, db)


async def require_manager_with_mfa(user: CurrentUser, db: DBSession) -> User:
    """Композиция роль-проверки и MFA-гейта для менеджера ЦНТР."""
    await require_verified_role("cntr_manager", "cntr_admin")(user)
    return await require_staff_mfa(user, db)


AdminWithMFA = Annotated[User, Depends(require_admin_with_mfa)]
ManagerWithMFA = Annotated[User, Depends(require_manager_with_mfa)]
