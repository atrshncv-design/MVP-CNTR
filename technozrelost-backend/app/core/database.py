from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings

# In tests every request runs on its own event loop (TestClient portal);
# pooled connections would be bound to a stale loop → NullPool for tests.
_poolclass = NullPool if settings.app_env == "test" else None


def pool_options() -> dict[str, int]:
    """Размер пула из настроек (таск 06); NullPool эти ключи не принимает."""
    return {"pool_size": settings.db_pool_size, "max_overflow": settings.db_max_overflow}


def _engine_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {"echo": False, "future": True, "pool_pre_ping": True}
    if _poolclass is not None:
        kwargs["poolclass"] = _poolclass
    else:
        kwargs.update(pool_options())
    return kwargs


engine: AsyncEngine = create_async_engine(settings.primary_dsn, **_engine_kwargs())

read_engine: AsyncEngine | None = None
if settings.replica_dsn:
    read_engine = create_async_engine(settings.replica_dsn, **_engine_kwargs())

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

# Фабрика read-сессий: Replica, если сконфигурирована, иначе Primary.
read_session_factory = (
    async_sessionmaker(read_engine, expire_on_commit=False, class_=AsyncSession)
    if read_engine is not None
    else None
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """Read-сессия (тикет 18): Replica, если задана DATABASE_REPLICA_URL.

    Только для безопасных чтений (реестры, каталоги) — без записи:
    реплика является hot standby и отклоняет любые мутации.
    Если replica не сконфигурирована — читает Primary (read-after-write).
    """
    factory = read_session_factory or SessionLocal
    async with factory() as session:
        yield session
