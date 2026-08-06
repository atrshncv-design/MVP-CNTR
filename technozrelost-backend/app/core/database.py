from __future__ import annotations

from collections.abc import AsyncGenerator

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

engine: AsyncEngine = create_async_engine(
    settings.primary_dsn,
    echo=False,
    future=True,
    pool_pre_ping=True,
    poolclass=_poolclass,
)

read_engine: AsyncEngine | None = None
if settings.replica_dsn:
    read_engine = create_async_engine(
        settings.replica_dsn,
        echo=False,
        future=True,
        pool_pre_ping=True,
        poolclass=_poolclass,
    )

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
