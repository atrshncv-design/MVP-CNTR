"""Тикет 21: досев демо-учёток без затирания стенда (BUG-1, история 26).

Шов — публичная HTTP-граница auth (`POST /auth/login`, `POST /auth/register`).
Reseed — только INSERT/UPSERT пяти demo-емейлов поверх существующих данных:
повторный прогон не плодит дублей, чужих пользователей не трогает.
Пароль — только именем `reset_demo.DEMO_PASSWORD` (значение не выписывать).
"""

from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import func, insert, literal, select, text

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.db import reset_demo
from app.db.models import Role, User, user_roles_tbl

OUTSIDER_EMAIL = "outsider.21@example.com"
OUTSIDER_MARKER = "untouched-marker/not-a-hash"
SELFREG_EMAIL = "selfreg.21@example.com"


async def _link_primary(user_id: int, role_slug: str) -> None:
    async with SessionLocal() as db:
        await db.execute(
            insert(user_roles_tbl).from_select(
                ["user_id", "role_id", "is_primary"],
                select(literal(user_id), Role.id, literal(True)).where(
                    Role.slug == role_slug
                ),
            )
        )
        await db.commit()


async def _setup_degraded() -> dict:
    """Деградировавший инвестор + посторонний пользователь (исходное состояние)."""
    async with SessionLocal() as db:
        stale = User(
            email="demo.investor@example.com",
            password_hash=hash_password(reset_demo.DEMO_PASSWORD + "-stale"),
            full_name="Stale",
            organization="Stale",
            is_active=False,
        )
        outsider = User(
            email=OUTSIDER_EMAIL,
            password_hash=OUTSIDER_MARKER,
            full_name="Outsider",
            organization="Outsider Org",
            is_active=True,
        )
        db.add_all([stale, outsider])
        await db.flush()
        stale_id = stale.id
        await db.commit()
    # Неверная primary-роль у инвестора, своя роль у постороннего.
    await _link_primary(stale_id, "gk_customer")
    async with SessionLocal() as db:
        outsider_id = await db.scalar(select(User.id).where(User.email == OUTSIDER_EMAIL))
    assert outsider_id is not None
    await _link_primary(outsider_id, "gk_customer")
    return {
        "outsider_hash": OUTSIDER_MARKER,
        "outsider_active": True,
        "outsider_name": "Outsider",
    }


async def _demo_snapshot() -> dict:
    specs = [u["email"] for u in reset_demo.DEMO_USERS]
    async with SessionLocal() as db:
        total = await db.scalar(
            select(func.count()).select_from(User).where(User.email.in_(specs))
        )
        distinct = await db.scalar(
            select(func.count(func.distinct(User.email))).where(User.email.in_(specs))
        )
        rows = (
            await db.execute(
                text(
                    """
                    SELECT u.email, r.slug
                    FROM public.users u
                    JOIN public.user_roles ur ON ur.user_id = u.id
                    JOIN public.roles r ON r.id = ur.role_id
                    WHERE ur.is_primary AND u.email LIKE 'demo.%@example.com'
                    """
                )
            )
        ).all()
        outsider = await db.scalar(select(User).where(User.email == OUTSIDER_EMAIL))
        return {
            "total": total,
            "distinct": distinct,
            "roles": {email: slug for email, slug in rows},
            "outsider": (
                None
                if outsider is None
                else {
                    "hash": outsider.password_hash,
                    "active": outsider.is_active,
                    "name": outsider.full_name,
                }
            ),
        }


def test_demo_reseed_upsert_and_idempotent(client: TestClient) -> None:
    """Деградировавший демо-инвестор чинится, повторный прогон — no-op."""
    before_outsider = asyncio.run(_setup_degraded())

    asyncio.run(reset_demo.seed_users())
    first = asyncio.run(_demo_snapshot())
    asyncio.run(reset_demo.seed_users())
    second = asyncio.run(_demo_snapshot())

    # Ровно пять учёток из сидов, без дублей; повторный прогон ничего не меняет.
    assert first["total"] == 5 and first["distinct"] == 5
    assert second == first

    # Роли — ровно из сидов (инвестор — напрямую сидом, не через self-register).
    expected = {u["email"]: u["role_slug"] for u in reset_demo.DEMO_USERS}
    assert first["roles"] == expected

    # Посторонний пользователь не тронут (хеш/активность/имя как были).
    assert second["outsider"] == {
        "hash": before_outsider["outsider_hash"],
        "active": before_outsider["outsider_active"],
        "name": before_outsider["outsider_name"],
    }

    # Вход каждой учётки — 200 с первой попытки (шов auth).
    for spec in reset_demo.DEMO_USERS:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": spec["email"], "password": reset_demo.DEMO_PASSWORD},
        )
        assert login.status_code == 200, login.text

    # Allowlist цел: investor через self-register — 403 и пользователь не создан.
    denied = client.post(
        "/api/v1/auth/register",
        json={
            "email": SELFREG_EMAIL,
            "password": reset_demo.DEMO_PASSWORD,
            "full_name": "Self Reg",
            "organization": "Self",
            "role_slug": "investor",
        },
    )
    assert denied.status_code == 403, denied.text

    async def _selfreg_absent() -> bool:
        async with SessionLocal() as db:
            return await db.scalar(select(User).where(User.email == SELFREG_EMAIL))

    assert asyncio.run(_selfreg_absent()) is None
