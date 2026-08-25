"""Каталог достижений: идемпотентный seed 66 медалей (тикет 01, спека §4.2).

Единый справочник — ``.scratch/news-achievements/catalog-66.md``; slug =
icon_key. Upsert по ``slug`` (ON CONFLICT DO UPDATE), чтобы правки
каталога применялись при повторном запуске и не плодились дубли.

Использование:
    uv run python -m app.db.seed_achievements

Функция ``seed(db)`` переиспользуется оркестратором (тикет 01): принимает
сессию, коммитит, возвращает число записей в каталоге.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal
from app.db.models import Achievement

# Формат строки: (slug, title, group, rarity, description,
#                 sector_slug, threshold, ugt_level, secret)
# Порядок и состав — строго по catalog-66.md (slug = icon_key).
_CATALOG: list[tuple[str, str, str, str, str, str | None, int | None, int | None, bool]] = [
    # ── ugt (9): командные, за подтверждённый переход уровня N ──────────────
    ("ugt-1", "УГТ 1 — Первая ступень", "ugt", "common",
     "Награждается команда проекта за подтверждённый переход на уровень УГТ 1.",
     None, None, 1, False),
    ("ugt-2", "УГТ 2 — Зарождение технологии", "ugt", "common",
     "Награждается команда проекта за подтверждённый переход на уровень УГТ 2.",
     None, None, 2, False),
    ("ugt-3", "УГТ 3 — Концепция доказана", "ugt", "common",
     "Награждается команда проекта за подтверждённый переход на уровень УГТ 3.",
     None, None, 3, False),
    ("ugt-4", "УГТ 4 — Прототип в лаборатории", "ugt", "common",
     "Награждается команда проекта за подтверждённый переход на уровень УГТ 4.",
     None, None, 4, False),
    ("ugt-5", "УГТ 5 — Технология подтверждена", "ugt", "common",
     "Награждается команда проекта за подтверждённый переход на уровень УГТ 5.",
     None, None, 5, False),
    ("ugt-6", "УГТ 6 — Демонстратор готов", "ugt", "common",
     "Награждается команда проекта за подтверждённый переход на уровень УГТ 6.",
     None, None, 6, False),
    ("ugt-7", "УГТ 7 — Пилотное внедрение", "ugt", "epic",
     "Награждается команда проекта за подтверждённый переход на уровень УГТ 7.",
     None, None, 7, False),
    ("ugt-8", "УГТ 8 — Серийное производство", "ugt", "epic",
     "Награждается команда проекта за подтверждённый переход на уровень УГТ 8.",
     None, None, 8, False),
    ("ugt-9", "УГТ 9 — Технологический прорыв", "ugt", "legendary",
     "Награждается команда проекта за подтверждённый переход на уровень УГТ 9.",
     None, None, 9, False),

    # ── documents (6): персональные, за принятые документы ──────────────────
    ("doc-first", "Первый принятый документ", "documents", "common",
     "Награждается за первый документ проекта, принятый по результатам проверки.",
     None, None, None, False),
    ("doc-5", "Начало пути — 5 документов", "documents", "common",
     "Награждается за 5 документов проекта, принятых по результатам проверки.",
     None, 5, None, False),
    ("doc-10", "Рабочий ритм — 10 документов", "documents", "common",
     "Награждается за 10 документов проекта, принятых по результатам проверки.",
     None, 10, None, False),
    ("doc-25", "Серьёзный вклад — 25 документов", "documents", "common",
     "Награждается за 25 документов проекта, принятых по результатам проверки.",
     None, 25, None, False),
    ("doc-50", "Половина сотни — 50 документов", "documents", "epic",
     "Награждается за 50 документов проекта, принятых по результатам проверки.",
     None, 50, None, False),
    ("doc-100", "Документальный архив — 100 документов", "documents", "legendary",
     "Награждается за 100 документов проекта, принятых по результатам проверки.",
     None, 100, None, False),

    # ── project (10): командные, за вехи проекта ────────────────────────────
    ("proj-first", "Первый проект команды", "project", "common",
     "Награждается команда за первый проект на платформе.",
     None, None, None, False),
    ("proj-first-request", "Первая заявка на переход УГТ", "project", "common",
     "Награждается команда за первую поданную заявку на переход УГТ.",
     None, None, None, False),
    ("proj-ugt3", "Проект достиг УГТ 3", "project", "common",
     "Награждается команда, когда её проект достигает уровня УГТ 3.",
     None, None, None, False),
    ("proj-ugt4", "Лабораторная победа — УГТ 4", "project", "common",
     "Награждается команда, когда её проект достигает уровня УГТ 4.",
     None, None, None, False),
    ("proj-ugt6", "Демонстратор — УГТ 6", "project", "epic",
     "Награждается команда, когда её проект достигает уровня УГТ 6.",
     None, None, None, False),
    ("proj-ugt7", "Пилот — УГТ 7", "project", "epic",
     "Награждается команда, когда её проект достигает уровня УГТ 7.",
     None, None, None, False),
    ("proj-ugt8", "Производство — УГТ 8", "project", "epic",
     "Награждается команда, когда её проект достигает уровня УГТ 8.",
     None, None, None, False),
    ("proj-ugt9", "Полный путь 1→9", "project", "legendary",
     "Награждается команда, прошедшая с проектом полный путь от УГТ 1 до УГТ 9.",
     None, None, None, False),
    ("proj-collector", "Коллекционер документов (все типы проекта)", "project", "epic",
     "Награждается команда, собравшая в проекте документы всех типов.",
     None, None, None, False),
    ("proj-3-sectors", "Полиглот отраслей (команда в 3+ отраслях)", "project", "epic",
     "Награждается команда, ведущая проекты в трёх и более отраслях.",
     None, None, None, False),

    # ── quality (8): за качество и скорость прохождения ─────────────────────
    ("q-clean", "Чистый проект (без возвратов до УГТ 4)", "quality", "common",
     "Награждается команда, прошедшая путь до УГТ 4 без единого возврата на доработку.",
     None, None, None, False),
    ("q-first-try", "С первой попытки (переход без отклонений)", "quality", "common",
     "Награждается команда, чей переход УГТ подтверждён с первой попытки, без отклонённых заявок.",
     None, None, None, False),
    ("q-leap", "Рывок (переход на 2+ уровня за цикл)", "quality", "epic",
     "Награждается команда, перешедшая на два и более уровня УГТ за один цикл.",
     None, None, None, False),
    ("q-sprint", "Спринтер (быстрый переход между уровнями)", "quality", "common",
     "Награждается команда за быстрый переход между уровнями УГТ.",
     None, None, None, False),
    ("q-marathon", "Марафонец (проект в работе более года)", "quality", "common",
     "Награждается команда, ведущая проект более года.",
     None, None, None, False),
    ("q-comeback", "Возвращение (откат → снова УГТ 7+)", "quality", "epic",
     "Награждается команда, вернувшаяся после отката уровня и вновь достигшая УГТ 7 и выше.",
     None, None, None, False),
    ("q-perfect-set", "Идеальный комплект (все документы с первой попытки)", "quality", "epic",
     "Награждается команда, все документы комплекта которой приняты с первой попытки.",
     None, None, None, False),
    ("q-fast-start", "Быстрый старт (первый документ за N дней)", "quality", "common",
     "Награждается команда, чей первый документ принят в кратчайший срок с момента старта проекта.",
     None, None, None, False),

    # ── sector (8): за отрасль проекта (по категории) ───────────────────────
    ("sector-agri", "Сельское хозяйство", "sector", "common",
     "Награждается за проект в отрасли «Сельское хозяйство».",
     "agriculture", None, None, False),
    ("sector-oil", "Нефтедобыча", "sector", "common",
     "Награждается за проект в отрасли «Нефтедобыча».",
     "oil", None, None, False),
    ("sector-machinery", "Машиностроение", "sector", "common",
     "Награждается за проект в отрасли «Машиностроение».",
     "machinery", None, None, False),
    ("sector-it", "IT и цифровые платформы", "sector", "common",
     "Награждается за проект в отрасли «IT и цифровые платформы».",
     "it", None, None, False),
    ("sector-medicine", "Медицина", "sector", "common",
     "Награждается за проект в отрасли «Медицина».",
     "medicine", None, None, False),
    ("sector-energy", "Энергетика", "sector", "common",
     "Награждается за проект в отрасли «Энергетика».",
     "energy", None, None, False),
    ("sector-transport", "Транспорт", "sector", "common",
     "Награждается за проект в отрасли «Транспорт».",
     "transport", None, None, False),
    ("sector-polyglot", "Межотраслевой лидер (3+ отраслей)", "sector", "epic",
     "Награждается команда, ведущая проекты в трёх и более отраслях.",
     None, None, None, False),

    # ── role (7): за действия менеджеров/экспертов ──────────────────────────
    ("role-verify-1", "Первая верификация", "role", "common",
     "Награждается менеджер за первую верифицированную заявку на переход УГТ.",
     None, 1, None, False),
    ("role-verify-10", "Опытный верификатор — 10 переходов", "role", "common",
     "Награждается менеджер за 10 верифицированных переходов УГТ.",
     None, 10, None, False),
    ("role-verify-50", "Мастер верификации — 50 переходов", "role", "epic",
     "Награждается менеджер за 50 верифицированных переходов УГТ.",
     None, 50, None, False),
    ("role-expert-1", "Первая экспертиза", "role", "common",
     "Награждается эксперт за первую проведённую экспертизу документа.",
     None, 1, None, False),
    ("role-expert-25", "Признанный эксперт — 25 проверок", "role", "epic",
     "Награждается эксперт за 25 проведённых проверок документов.",
     None, 25, None, False),
    ("role-mentor", "Наставник (команда дошла до УГТ 4+)", "role", "epic",
     "Награждается наставник, чья команда достигла УГТ 4 и выше.",
     None, None, None, False),
    ("role-fast-check", "Быстрая проверка (< 3 рабочих дней)", "role", "common",
     "Награждается за проверку документа менее чем за три рабочих дня.",
     None, None, None, False),

    # ── member (7): персональные мета-медали ────────────────────────────────
    ("m-first-medal", "Первая медаль", "member", "common",
     "Награждается за первую полученную медаль платформы.",
     None, None, None, False),
    ("m-5-medals", "Начало коллекции — 5 медалей", "member", "common",
     "Награждается за 5 полученных медалей.",
     None, 5, None, False),
    ("m-15-medals", "Коллекционер опыта — 15 медалей", "member", "common",
     "Награждается за 15 полученных медалей.",
     None, 15, None, False),
    ("m-30-medals", "Ветеран платформы — 30 медалей", "member", "epic",
     "Награждается за 30 полученных медалей.",
     None, 30, None, False),
    ("m-3-projects", "Мультипроектность (3+ проектов одновременно)", "member", "common",
     "Награждается за одновременное участие в трёх и более проектах.",
     None, None, None, False),
    ("m-longhaul", "Долгожитель (в команде от УГТ 1 до УГТ 4+)", "member", "common",
     "Награждается за нахождение в команде проекта на всём пути от УГТ 1 до УГТ 4 и выше.",
     None, None, None, False),
    ("m-5-projects", "Вклад в 5+ проектов", "member", "epic",
     "Награждается за вклад в пять и более проектов платформы.",
     None, None, None, False),

    # ── organization (5): за достижения организации ─────────────────────────
    ("org-first", "Первый проект организации", "organization", "common",
     "Награждается организация за первый проект на платформе.",
     None, None, None, False),
    ("org-5-projects", "5 проектов организации", "organization", "common",
     "Награждается организация за пять проектов на платформе.",
     None, 5, None, False),
    ("org-3-sectors", "3 отрасли организации", "organization", "common",
     "Награждается организация, ведущая проекты в трёх отраслях.",
     None, None, None, False),
    ("org-10-docs", "10 документов организации", "organization", "common",
     "Награждается организация за 10 документов, принятых по её проектам.",
     None, 10, None, False),
    ("org-ugt6", "Проект организации до УГТ 6+", "organization", "epic",
     "Награждается организация, чей проект достиг УГТ 6 и выше.",
     None, None, None, False),

    # ── secret (6): скрыты до получения ─────────────────────────────────────
    ("s-ghost", "Призрак (путь 1→9 без единого возврата)", "secret", "legendary",
     "Награждается команда, прошедшая путь от УГТ 1 до УГТ 9 без единого возврата.",
     None, None, None, True),
    ("s-comet", "Комета (рекордное время 1→9)", "secret", "legendary",
     "Награждается команда, прошедшая путь от УГТ 1 до УГТ 9 за рекордное время.",
     None, None, None, True),
    ("s-pioneer", "Первопроходец (первый проект в отрасли)", "secret", "epic",
     "Награждается команда, открывшая новую отрасль — первый проект платформы в ней.",
     None, None, None, True),
    ("s-phoenix", "Феникс (дважды вернулся с УГТ 4+ → УГТ 7+)", "secret", "epic",
     "Награждается команда, дважды пережившая откат с УГТ 4 и выше и вновь достигшая УГТ 7 и выше.",
     None, None, None, True),
    ("s-epic-collection", "Эпическая коллекция (все 9 УГТ-медалей)", "secret", "legendary",
     "Награждается за собрание всех девяти УГТ-медалей платформы.",
     None, None, None, True),
    ("s-legend", "Легенда платформы (100+ медалей)", "secret", "legendary",
     "Награждается за 100 и более наград в коллекции — легенда платформы.",
     None, None, None, True),
]


async def seed(db: AsyncSession) -> int:
    """Идемпотентный upsert каталога (ON CONFLICT (slug) DO UPDATE).

    Возвращает итоговое число записей в каталоге после коммита.
    """
    for sort_order, item in enumerate(_CATALOG, start=1):
        slug, title, group_, rarity, description, sector_slug, threshold, ugt_level, secret = item
        stmt = insert(Achievement).values(
            slug=slug,
            title=title,
            description=description,
            group=group_,
            rarity=rarity,
            sector_slug=sector_slug,
            threshold=threshold,
            ugt_level=ugt_level,
            secret=secret,
            sort_order=sort_order,
            icon_key=slug,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[Achievement.slug],
            set_={
                "title": title,
                "description": description,
                "group": group_,
                "rarity": rarity,
                "sector_slug": sector_slug,
                "threshold": threshold,
                "ugt_level": ugt_level,
                "secret": secret,
                "sort_order": sort_order,
                "icon_key": slug,
                "updated_at": func.now(),
            },
        )
        await db.execute(stmt)
    await db.commit()
    total = await db.scalar(select(func.count()).select_from(Achievement))
    return int(total or 0)


async def _main() -> None:
    async with SessionLocal() as db:
        total = await seed(db)
    print(f"Каталог достижений: {total} медалей (идемпотентно, slug=icon_key)")


if __name__ == "__main__":
    asyncio.run(_main())
