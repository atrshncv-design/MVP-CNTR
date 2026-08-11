"""MFA-сервис (тикет 02 identity-organizations).

- TOTP по RFC 6238 на СТАНДАРТНОЙ библиотеке: HMAC-SHA1, 6 цифр, шаг 30с,
  допустимое отклонение ±1 окно (сверка по трём счётчикам).
- Секрет шифруется Fernet (cryptography, ключ MFA_SECRET_ENCRYPTION_KEY) —
  открытый секрет в БД/логах не хранится.
- Recovery-коды: secrets.token_urlsafe, в БД — только sha256-хеши.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
from datetime import UTC, datetime
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_TOTP_STEP_SECONDS = 30
_TOTP_DIGITS = 6
_TOTP_ALLOWED_WINDOWS = 1  # ±1 шаг в обе стороны (RFC 6238 tolerance)
_RECOVERY_CODE_BYTES = 7  # token_urlsafe(7) → 10 символов без padding


# ─── Fernet ──────────────────────────────────────────────────────────────────


def _fernet() -> Fernet:
    """Создаёт Fernet из настроек; отсутствие ключа — явная ошибка старта."""
    key = settings.mfa_secret_encryption_key
    if not key:
        raise RuntimeError(
            "MFA_SECRET_ENCRYPTION_KEY не задан: шифрование MFA-секретов невозможно. "
            "Задайте ключ в .env (см. .env.example)."
        )
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as exc:  # невалидный формат ключа
        raise RuntimeError(
            "MFA_SECRET_ENCRYPTION_KEY имеет неверный формат: ожидается Fernet-ключ "
            "(32 байта в urlsafe base64). Сгенерируйте: "
            "python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        ) from exc


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(secret_encrypted: str) -> str:
    try:
        return _fernet().decrypt(secret_encrypted.encode()).decode()
    except InvalidToken as exc:  # ключ сменился / данные повреждены
        raise RuntimeError(
            "Не удалось расшифровать MFA-секрет: проверьте MFA_SECRET_ENCRYPTION_KEY"
        ) from exc


# ─── TOTP (RFC 6238, stdlib) ─────────────────────────────────────────────────


def generate_secret() -> str:
    """20 байт (160 бит) случайности → base32 без padding (стандарт TOTP)."""
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def otpauth_url(secret: str, email: str) -> str:
    label = quote(f"Технозрелость:{email}", safe="")
    return (
        f"otpauth://totp/{label}?secret={secret}"
        f"&issuer={quote('Технозрелость', safe='')}"
        f"&algorithm=SHA1&digits={_TOTP_DIGITS}&period={_TOTP_STEP_SECONDS}"
    )


def _totp_code(secret: str, at: datetime) -> str:
    """TOTP-код для момента времени (RFC 6238: HMAC-SHA1, 6 цифр, 30с)."""
    key = base64.b32decode(secret, casefold=True)
    counter = int(at.timestamp()) // _TOTP_STEP_SECONDS
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % (
        10**_TOTP_DIGITS
    )
    return f"{code:0{_TOTP_DIGITS}d}"


def verify_totp(secret: str, code: str, now: datetime | None = None) -> bool:
    """Проверка TOTP-кода с допустимым отклонением ±1 шаг (RFC 6238)."""
    if not code or not code.isdigit() or len(code) != _TOTP_DIGITS:
        return False
    at = now or datetime.now(UTC)
    for window in range(-_TOTP_ALLOWED_WINDOWS, _TOTP_ALLOWED_WINDOWS + 1):
        step = window * _TOTP_STEP_SECONDS
        shifted = at.fromtimestamp(at.timestamp() + step, tz=UTC)
        if secrets.compare_digest(_totp_code(secret, shifted), code):
            return True
    return False


# ─── Recovery-коды ───────────────────────────────────────────────────────────


def generate_recovery_codes(count: int | None = None) -> list[str]:
    """Набор одноразовых recovery-кодов (по умолчанию 10×10 символов)."""
    n = count or settings.mfa_recovery_codes_count
    return [secrets.token_urlsafe(_RECOVERY_CODE_BYTES) for _ in range(n)]


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()
