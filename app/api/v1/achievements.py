"""Каталог достижений (тикет 01, спека §4.2).

Публичный ``GET /achievements/catalog`` (паттерн реестров —
``CurrentUserOptional`` + ``ReadDBSession``): полный каталог 66 медалей,
сортировка по sort_order.

Секретные медали не скрываются из каталога: флаг ``secret`` и описание
видны всегда, а раскрытие секрета делает витрина по состоянию
пользователя (тикет 03).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUserOptional, ReadDBSession
from app.core.rate_limit import rate_limit
from app.db.models import Achievement
from app.schemas import AchievementCatalogOut

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("/catalog", response_model=list[AchievementCatalogOut])
async def achievements_catalog(
    db: ReadDBSession,
    user: CurrentUserOptional,
    _: None = Depends(
        rate_limit("registry", settings.rate_limit_registry_per_minute)
    ),
) -> list[AchievementCatalogOut]:
    """Публичный каталог достижений (спека §4.2), сортировка sort_order."""
    rows = (
        (
            await db.execute(
                select(Achievement).order_by(Achievement.sort_order, Achievement.id)
            )
        )
        .scalars()
        .all()
    )
    return [
        AchievementCatalogOut(
            id=a.id,
            slug=a.slug,
            title=a.title,
            description=a.description,
            group=a.group,
            rarity=a.rarity,
            sector_slug=a.sector_slug,
            threshold=a.threshold,
            ugt_level=a.ugt_level,
            secret=a.secret,
            sort_order=a.sort_order,
            icon_key=a.icon_key,
        )
        for a in rows
    ]
