from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return str(pwd_context.hash(plain))


def verify_password(plain: str, hashed: str) -> bool:
    return bool(pwd_context.verify(plain, hashed))


def create_access_token(subject: str | int, extra: dict[str, Any] | None = None) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_ttl_minutes)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "type": "access",
        "jti": uuid.uuid4().hex,
    }
    if extra:
        payload.update(extra)
    return str(jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm))


def create_refresh_token(subject: str | int) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_ttl_days)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "type": "refresh",
        "jti": uuid.uuid4().hex,  # уникальность: JWT с одинаковым exp идентичен
    }
    return str(jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm))


def decode_token(token: str) -> dict[str, Any]:
    return dict(jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]))


def hash_token(token: str) -> str:
    """SHA-256 хеш токена для хранения в БД (отзыв без хранения JWT в открытом виде)."""
    return hashlib.sha256(token.encode()).hexdigest()


# ─── Атрибуция «поделился ссылкой» (N-01) ─────────────────────────────────────
# Клиент-controlled ID перебираем (serial), поэтому авторство ссылки
# подтверждается HMAC-подписью, которую выдаёт и проверяет только сервер.

_SHARE_SIG_PURPOSE = b"share-attribution-v1"
_SHARE_SIG_TTL_DAYS = 30


def _share_sig_key() -> bytes:
    # Отдельный ключ из jwt_secret через HKDF-подобный вывод: утечка подписей
    # ссылок не должна превращаться в подделку JWT (и наоборот).
    return hmac.new(settings.jwt_secret.encode(), _SHARE_SIG_PURPOSE, hashlib.sha256).digest()


def sign_share_attribution(project_id: int, user_id: int) -> str:
    """Подписывает атрибуцию ссылки: проект + автор + срок жизни.

    Формат ``user_id:expires_ts:hmac_hex`` — подпись привязана к проекту,
    поэтому подпись одного проекта нельзя переиграть в другом.
    """
    expires = int((datetime.now(UTC) + timedelta(days=_SHARE_SIG_TTL_DAYS)).timestamp())
    payload = f"{project_id}:{user_id}:{expires}"
    digest = hmac.new(_share_sig_key(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{user_id}:{expires}:{digest}"


def verify_share_attribution(project_id: int, value: str) -> int | None:
    """Возвращает ID автора ссылки, если подпись валидна для проекта и не истекла."""
    try:
        user_raw, expires_raw, digest = value.split(":")
        user_id, expires = int(user_raw), int(expires_raw)
        payload = f"{project_id}:{user_id}:{expires}"
    except (ValueError, AttributeError):
        return None
    expected = hmac.new(_share_sig_key(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, digest):
        return None
    if datetime.fromtimestamp(expires, tz=UTC) < datetime.now(UTC):
        return None
    return user_id
