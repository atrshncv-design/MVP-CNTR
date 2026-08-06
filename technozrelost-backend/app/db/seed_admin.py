"""Create or update a local test administrator from environment variables.

Usage:
    TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... uv run python -m app.db.seed_admin
"""

from __future__ import annotations

import asyncio
import os

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.db.models import Role, User


def admin_credentials() -> tuple[str, str]:
    email = os.environ.get("TEST_ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("TEST_ADMIN_PASSWORD", "")
    if not email or len(password) < 12:
        raise SystemExit(
            "TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD (12+ characters) are required"
        )
    return email, password


async def seed() -> None:
    email, password = admin_credentials()
    async with SessionLocal() as db:
        role = await db.scalar(select(Role).where(Role.slug == "cntr_admin"))
        if role is None:
            raise SystemExit("cntr_admin role is missing; run Alembic migrations first")

        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                password_hash=hash_password(password),
                full_name="Тестовый администратор ЦНТР",
                organization="ЦНТР · локальная проверка",
                is_active=True,
                is_superuser=True,
                roles=[role],
            )
            db.add(user)
        else:
            user.password_hash = hash_password(password)
            user.is_active = True
            user.is_superuser = True
            if role not in user.roles:
                user.roles.append(role)
        await db.commit()

    print(f"Test administrator is ready: {email}")


if __name__ == "__main__":
    asyncio.run(seed())
