"""Короткоживущие подписанные ссылки на файлы (тикет 02 security-infrastructure).

Токен вида ``<file_id>.<expires_unix>.<hmac_hex>``: HMAC-SHA256 подпись над
payload ``<file_id>:<expires_unix>``. Секрет берётся из settings и **не
хранится в БД** — подпись проверяется на лету при каждом запросе. Токен
привязан к file_id, срок действия задаётся при создании (TTL 5–15 минут).

Повторное использование токена допустимо до истечения TTL (это не строго
одноразовая ссылка); после истечения любое использование даёт 410.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass

from app.core.config import settings

# Допустимый диапазон TTL (минут), по спеке тикета 02.
TTL_MIN_MINUTES = 5
TTL_MAX_MINUTES = 15


class SignedTokenError(Exception):
    """Базовое исключение подписанных ссылок."""


class SignedTokenInvalid(SignedTokenError):
    """Подпись недействительна: повреждена, подделана или чужой file_id."""


class SignedTokenExpired(SignedTokenError):
    """Срок действия подписи истёк."""


@dataclass(frozen=True)
class SignedToken:
    token: str
    file_id: int
    expires_at: int  # unix-секунды


def _secret() -> str:
    return settings.signed_url_secret


def _sign(file_id: int, expires_at: int) -> str:
    payload = f"{file_id}:{expires_at}"
    return hmac.new(_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def create_signed_token(
    file_id: int,
    *,
    ttl_minutes: int | None = None,
    now: int | None = None,
) -> SignedToken:
    """Создаёт подписанный токен для файла (TTL из settings или явный)."""
    ttl = settings.signed_url_ttl_minutes if ttl_minutes is None else ttl_minutes
    if not TTL_MIN_MINUTES <= ttl <= TTL_MAX_MINUTES:
        raise ValueError(
            f"TTL подписанной ссылки должен быть в диапазоне "
            f"{TTL_MIN_MINUTES}–{TTL_MAX_MINUTES} минут, получено {ttl}"
        )
    current = int(time.time()) if now is None else int(now)
    expires_at = current + ttl * 60
    signature = _sign(file_id, expires_at)
    return SignedToken(
        token=f"{file_id}.{expires_at}.{signature}",
        file_id=file_id,
        expires_at=expires_at,
    )


def verify_signed_token(token: str, file_id: int, *, now: int | None = None) -> int:
    """Проверяет подпись и срок; возвращает expires_at (unix).

    Raises:
        SignedTokenInvalid: невалидный формат/подпись/чужой file_id.
        SignedTokenExpired: срок действия истёк.
    """
    current = int(time.time()) if now is None else int(now)
    try:
        token_file_id_s, expires_at_s, signature = token.split(".", 2)
        token_file_id = int(token_file_id_s)
        expires_at = int(expires_at_s)
    except (ValueError, AttributeError):
        raise SignedTokenInvalid("Невалидный формат подписи") from None

    if token_file_id != file_id:
        raise SignedTokenInvalid("Подпись не относится к запрошенному файлу")
    expected = _sign(file_id, expires_at)
    if not hmac.compare_digest(expected, signature):
        raise SignedTokenInvalid("Недействительная подпись")
    if expires_at <= current:
        raise SignedTokenExpired("Срок действия ссылки истёк")
    return expires_at
