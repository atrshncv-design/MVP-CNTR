from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.db.models import User

bearer_scheme = HTTPBearer(auto_error=False)
DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DBSession,
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Не авторизован")
    try:
        payload = decode_token(creds.credentials)
        user_id = int(payload["sub"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невалидный токен") from exc
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь неактивен")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*slugs: str) -> Any:
    allowed = set(slugs)

    async def _checker(user: CurrentUser) -> User:
        user_slugs = {r.slug for r in user.roles}
        if user_slugs & allowed or user.is_superuser:
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
