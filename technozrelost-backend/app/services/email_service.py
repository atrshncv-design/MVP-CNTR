"""Доставка email-сообщений (тикет 01 identity-organizations).

Правила безопасности:
* Открытые токены НЕ логируются и НЕ возвращаются в API-ответах.
* В БД хранится только SHA-256 хеш токена (см. app.core.security.hash_token).
* В APP_ENV=test (или при отсутствии SMTP-настроек) используется ТЕСТОВАЯ
  доставка: письмо пишется в таблицу public.email_outbox. В test-профиле в
  outbox дополнительно сохраняется открытый токен — исключительно для тестов.
* SMTP-адаптер (SmtpEmailDelivery) — заглушка: параметры берутся из settings
  (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS, см. .env.example), реальная
  отправка не выполняется. Секреты в коде отсутствуют.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_token
from app.db.models import EmailOutbox

logger = logging.getLogger(__name__)


class EmailDeliveryService:
    """Интерфейс доставки писем: send_verification / send_reset."""

    async def send_verification(self, db: AsyncSession, email: str, token: str) -> None:
        raise NotImplementedError

    async def send_reset(self, db: AsyncSession, email: str, token: str) -> None:
        raise NotImplementedError


class TestEmailDelivery(EmailDeliveryService):
    """Тестовая доставка: письмо пишется в outbox-таблицу.

    Открытый токен сохраняется только в APP_ENV=test (для тестов); в любом
    другом профиле пишется только token_hash — открытый токен нигде не хранится.
    """

    async def _deliver(self, db: AsyncSession, email: str, template: str, token: str) -> None:
        subject = {
            "verification": "Подтверждение email — Технозрелость",
            "password_reset": "Восстановление пароля — Технозрелость",
        }[template]
        db.add(
            EmailOutbox(
                recipient=email,
                subject=subject,
                template=template,
                token=token if settings.app_env == "test" else None,
                token_hash=hash_token(token),
                status="pending",
            )
        )
        await db.commit()
        logger.info("EMAIL[%s] test-delivery -> %s", template, email)

    async def send_verification(self, db: AsyncSession, email: str, token: str) -> None:
        await self._deliver(db, email, "verification", token)

    async def send_reset(self, db: AsyncSession, email: str, token: str) -> None:
        await self._deliver(db, email, "password_reset", token)


class SmtpEmailDelivery(EmailDeliveryService):
    """Заглушка SMTP-адаптера.

    Реальная отправка не реализована (подключается адаптером позже); имя
    переменных конфигурации зафиксировано в .env.example (SMTP_HOST/SMTP_PORT/
    SMTP_USER/SMTP_PASS) — секреты в код не зашиваются.
    """

    def __init__(self) -> None:
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.user = settings.smtp_user

    async def _log_delivery(self, email: str, template: str) -> None:
        logger.warning(
            "SMTP-доставка не реализована (адаптер-заглушка): %s -> %s (host=%s)",
            template,
            email,
            self.host,
        )

    async def send_verification(self, db: AsyncSession, email: str, token: str) -> None:
        await self._log_delivery(email, "verification")

    async def send_reset(self, db: AsyncSession, email: str, token: str) -> None:
        await self._log_delivery(email, "password_reset")


def get_email_service() -> EmailDeliveryService:
    """Выбор доставки: тестовая (outbox) в test/без SMTP, иначе заглушка SMTP."""
    if settings.app_env == "test" or not settings.smtp_host:
        return TestEmailDelivery()
    return SmtpEmailDelivery()
