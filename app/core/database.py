from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

engine: AsyncEngine = create_async_engine(
    settings.primary_dsn,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

read_engine: AsyncEngine | None = None
if settings.replica_dsn:
    read_engine = create_async_engine(
        settings.replica_dsn,
        echo=False,
        future=True,
        pool_pre_ping=True,
    )

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
