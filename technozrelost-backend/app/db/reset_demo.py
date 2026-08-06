"""Повторяемая демо-среда: полный сброс и сидирование демо-БД (тикет 19).

Использование:
    uv run python -m app.db.reset_demo --full        # TRUNCATE всех таблиц + seed
    uv run python -m app.db.reset_demo --seed-only   # только seed (идемпотентно)

`--full` очищает все таблицы приложения (кроме справочников ролей/прав и
служебных таблиц миграций) и заново создаёт демо-аккаунты ролей, десять
демо-проектов (9 опубликованных с УГТ 1–9 + один для последовательного пути
1→9) и импортирует полный массив НИОКТР из data/nioktr_all.json.

`--seed-only` дополняет текущие данные, ничего не удаляя: пользователи
дедуплицируются по email, проекты — по названию, НИОКТР — по
registration_number (seed_nioktr). Повторный запуск не создаёт дубликатов.

В production-профиле (APP_ENV=production) reset заблокирован (спека, US 101).
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, insert, literal, select, text

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.db import seed_nioktr
from app.db.models import Project, ProjectMember, Role, User, user_roles_tbl

# Таблицы-справочники и служебные таблицы не трогаем: роли/права сеются
# миграцией 0003, stage_requirements — миграцией 0010, версии миграций
# хранят alembic_version/db_migration_log.
RESET_EXCLUDE = {
    "alembic_version",
    "db_migration_log",
    "roles",
    "permissions",
    "role_permissions",
    "stage_requirements",
}

DEFAULT_NIOKTR_INPUT = Path(__file__).resolve().parent.parent.parent / "data" / "nioktr_all.json"

# Синтетические учётные записи демо-среды (dev-only; перед прод-деплоем
# данные пересоздаются). Один общий пароль для всех демо-аккаунтов.
DEMO_PASSWORD = "DemoPass123!"

DEMO_USERS = [
    {
        "email": "demo.gk@example.com",
        "full_name": "ГК Демо-заказчик",
        "organization": "Государственная компания (демо)",
        "role_slug": "gk_customer",
    },
    {
        "email": "demo.rd@example.com",
        "full_name": "R&D Демо-исполнитель",
        "organization": "НИИ Демо-исполнитель",
        "role_slug": "rd_executor",
    },
    {
        "email": "demo.manager@example.com",
        "full_name": "Менеджер ЦНТР (демо)",
        "organization": "ЦНТР · демо",
        "role_slug": "cntr_manager",
    },
    {
        "email": "demo.admin@example.com",
        "full_name": "Администратор ЦНТР (демо)",
        "organization": "ЦНТР · демо",
        "role_slug": "cntr_admin",
    },
    {
        "email": "demo.investor@example.com",
        "full_name": "Инвестор (демо)",
        "organization": "Инвестиционный фонд (демо)",
        "role_slug": "investor",
    },
]

_CATEGORIES = [
    "Промышленные технологии",
    "Искусственный интеллект",
    "Новые материалы",
    "Биотехнологии",
    "Энергетика",
    "Приборостроение",
    "Робототехника",
    "Композитные материалы",
    "Цифровые платформы",
]


def demo_projects() -> list[dict]:
    """Девять опубликованных проектов с УГТ 1–9 + один последовательный 1→9."""
    projects = []
    for level in range(1, 10):
        projects.append(
            {
                "name": f"Демо-проект · УГТ {level}",
                "description": (
                    f"Готовый демонстрационный проект на уровне УГТ {level} "
                    "для проверки реестров и фильтров (ГОСТ Р 58048-2017)."
                ),
                "category": _CATEGORIES[level - 1],
                "target_level": 9,
                "current_level": level,
                "status": "published",
                "is_public": True,
                "budget": 1_000_000 + level * 250_000,
            }
        )
    projects.append(
        {
            "name": "Демо-проект · последовательный путь 1→9",
            "description": (
                "Проект для последовательной приёмки полного бизнес-пути: "
                "стартует с УГТ 1 и проходит все уровни до УГТ 9."
            ),
            "category": "Промышленные технологии",
            "target_level": 9,
            "current_level": 1,
            "status": "draft",
            "is_public": False,
            "budget": 5_000_000,
        }
    )
    return projects


def _check_production_guard() -> None:
    from app.core.config import settings

    if settings.app_env.lower() == "production":
        raise SystemExit(
            "Демо-reset заблокирован в production-профиле (APP_ENV=production): "
            "сброс уничтожил бы боевые данные (спека, US 101)."
        )


async def reset_database() -> None:
    """TRUNCATE всех таблиц приложения (кроме справочников и служебных)."""
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
            )
        ).all()
        tables = sorted(row[0] for row in rows if row[0] not in RESET_EXCLUDE)
        if not tables:
            raise SystemExit("Не найдены таблицы для сброса — проверьте подключение к БД.")
        await db.execute(
            text(
                "TRUNCATE TABLE "
                + ", ".join(f"public.{name}" for name in tables)
                + " RESTART IDENTITY CASCADE"
            )
        )
        await db.commit()
        print(f"Сброшено таблиц: {len(tables)} ({', '.join(tables[:5])}, …)")


async def seed_users() -> None:
    """Демо-пользователи всех ролей (идемпотентно по email)."""
    async with SessionLocal() as db:
        for spec in DEMO_USERS:
            existing = await db.scalar(select(User).where(User.email == spec["email"]))
            if existing is not None:
                continue
            role_row = await db.scalar(select(Role).where(Role.slug == spec["role_slug"]))
            if role_row is None:
                raise SystemExit(
                    f"Роль '{spec['role_slug']}' не найдена — примените миграции "
                    "(uv run alembic upgrade head)."
                )
            user = User(
                email=spec["email"],
                password_hash=hash_password(DEMO_PASSWORD),
                full_name=spec["full_name"],
                organization=spec["organization"],
                is_active=True,
            )
            db.add(user)
            await db.flush()
            # user_roles имеет UNIQUE на primary-роль — удаляем возможные старые
            # назначения, затем вставляем ровно одну primary-роль (паттерн tests/support.py).
            await db.execute(delete(user_roles_tbl).where(user_roles_tbl.c.user_id == user.id))
            await db.execute(
                insert(user_roles_tbl).from_select(
                    ["user_id", "role_id", "is_primary"],
                    select(literal(user.id), Role.id, literal(True)).where(
                        Role.slug == spec["role_slug"]
                    ),
                )
            )
        await db.commit()
    print(f"Демо-пользователи: {len(DEMO_USERS)} (дедупликация по email)")


async def seed_projects() -> None:
    """Девять проектов УГТ 1–9 + последовательный 1→9 (идемпотентно по названию)."""
    async with SessionLocal() as db:
        owner = await db.scalar(select(User).where(User.email == DEMO_USERS[0]["email"]))
        rd = await db.scalar(select(User).where(User.email == DEMO_USERS[1]["email"]))
        if owner is None or rd is None:
            raise SystemExit("Демо-пользователи не найдены — сначала выполните seed_users().")
        now = datetime.now(UTC)
        for spec in demo_projects():
            existing = await db.scalar(select(Project).where(Project.name == spec["name"]))
            if existing is not None:
                continue
            project = Project(
                name=spec["name"],
                description=spec["description"],
                category=spec["category"],
                target_level=spec["target_level"],
                current_level=spec["current_level"],
                status=spec["status"],
                is_public=spec["is_public"],
                budget=spec["budget"],
                created_by=owner.id,
                published_at=now if spec["is_public"] else None,
            )
            db.add(project)
            await db.flush()
            db.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=owner.id,
                    role_in_project="gk_customer",
                    status="active",
                    is_priority=True,
                    is_project_admin=True,
                )
            )
            db.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=rd.id,
                    role_in_project="rd_executor",
                    status="active",
                    is_priority=False,
                    is_project_admin=False,
                )
            )
        await db.commit()
    print(f"Демо-проекты: {len(demo_projects())} (дедупликация по названию)")


async def seed_all(nioktr_input: Path | None = None) -> None:
    """Полный seed демо-среды: пользователи + проекты + НИОКТР (идемпотентно)."""
    await seed_users()
    await seed_projects()
    source = nioktr_input or DEFAULT_NIOKTR_INPUT
    if not source.exists():
        raise SystemExit(f"Файл НИОКТР не найден: {source}")
    await seed_nioktr.seed(source, drop_old_technologies=True)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Повторяемая демо-среда: сброс и сидирование демо-БД (тикет 19)."
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--full", action="store_true", help="полный сброс (TRUNCATE) + seed")
    mode.add_argument(
        "--seed-only", action="store_true", help="только seed поверх данных (идемпотентно)"
    )
    parser.add_argument(
        "--nioktr-input",
        default=str(DEFAULT_NIOKTR_INPUT),
        help="путь к JSON-массиву НИОКТР (по умолчанию data/nioktr_all.json)",
    )
    args = parser.parse_args(argv)

    _check_production_guard()

    if args.full:
        asyncio.run(reset_database())
    asyncio.run(seed_all(Path(args.nioktr_input)))
    print("Демо-среда готова. Аккаунты и пароль см. в README.md → «Демо-среда (seed/reset)».")


if __name__ == "__main__":
    main()
