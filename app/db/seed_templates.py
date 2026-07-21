"""Seed RAG templates into the database.

Usage:
    uv run python app/db/seed_templates.py
"""

from __future__ import annotations

import asyncio
import hashlib

from app.core.database import SessionLocal
from app.core.embeddings import embed_text
from app.db.models import RagDocument

TEMPLATES = [
    {
        "title": "ТЗ — базовый шаблон",
        "doc_type": "tz",
        "ugt_level": None,
        "raw_text": """ТЕХНИЧЕСКОЕ ЗАДАНИЕ

1. Наименование проекта: {{project_name}}

2. Основание для разработки: {{project_description}}

3. Цель работы: Разработка технологии до уровня УГТ {{target_level}}.

4. Категория проекта: {{project_category}}

5. Технические требования:
   5.1. Технология должна соответствовать критериям уровней УГТ 1–{{target_level}}.
   5.2. По каждому уровню должны быть подтверждены все контрольные пункты.
   5.3. Результаты работ оформляются в соответствии с ГОСТ Р 58048-2017.

6. Состав работ:
   - Проведение анализа текущего уровня УГТ {{current_level}}.
   - Выполнение мероприятий по достижению целевого уровня УГТ {{target_level}}.
   - Подготовка отчётной документации по каждому этапу.

7. Порядок контроля и приёмки:
   - Контрольная точка КТ-1: утверждение концепции.
   - Промежуточные контрольные точки по уровням УГТ.
   - Итоговая приёмка по достижении УГТ {{target_level}}.

8. Бюджет проекта: {{project_budget}} руб.

9. Перечень документации:
   - Паспорт проекта
   - Техническое задание (настоящий документ)
   - Технико-экономическое обоснование
   - Отчёты по каждому уровню УГТ
   - Итоговый отчёт
""",
        "template_metadata": {
            "variables": [
                {"name": "project_name", "label": "Название проекта",
                 "source": "project.name"},
                {"name": "project_description", "label": "Описание проекта",
                 "source": "project.description"},
                {"name": "project_category", "label": "Категория проекта",
                 "source": "project.category"},
                {"name": "target_level", "label": "Целевой УГТ",
                 "source": "project.target_level"},
                {"name": "current_level", "label": "Текущий УГТ",
                 "source": "project.current_level"},
                {"name": "project_budget", "label": "Бюджет",
                 "source": "project.budget"},
            ],
        },
    },
    {
        "title": "Паспорт проекта — базовый шаблон",
        "doc_type": "passport",
        "ugt_level": None,
        "raw_text": """ПАСПОРТ ПРОЕКТА

1. Общие сведения:
   1.1. Наименование проекта: {{project_name}}
   1.2. Категория: {{project_category}}
   1.3. Статус: {{project_status}}

2. Описание проекта:
   {{project_description}}

3. Уровни готовности технологии:
   3.1. Текущий уровень УГТ: {{current_level}}
   3.2. Целевой уровень УГТ: {{target_level}}

4. Показатели результативности:
   - УГТ-профиль по 9 уровням:
     УГТ 1: {{level_1_percentage}}
     УГТ 2: {{level_2_percentage}}
     УГТ 3: {{level_3_percentage}}
     УГТ 4: {{level_4_percentage}}
     УГТ 5: {{level_5_percentage}}
     УГТ 6: {{level_6_percentage}}
     УГТ 7: {{level_7_percentage}}
     УГТ 8: {{level_8_percentage}}
     УГТ 9: {{level_9_percentage}}

5. Бюджет проекта: {{project_budget}} руб.

6. Участники проекта (роли):
   - Заказчик (ГосКомпания)
   - Исполнитель (R&D)
   - Эксперт УГТ

7. Контрольные точки:
   - КТ-1: Старт проекта
   - КТ-2: Завершение НИР
   - КТ-3: Создание прототипа
   - КТ-4: Внедрение
""",
        "template_metadata": {
            "variables": [
                {"name": "project_name", "label": "Название проекта",
                 "source": "project.name"},
                {"name": "project_description", "label": "Описание проекта",
                 "source": "project.description"},
                {"name": "project_category", "label": "Категория проекта",
                 "source": "project.category"},
                {"name": "project_status", "label": "Статус проекта",
                 "source": "project.status"},
                {"name": "target_level", "label": "Целевой УГТ",
                 "source": "project.target_level"},
                {"name": "current_level", "label": "Текущий УГТ",
                 "source": "project.current_level"},
                {"name": "project_budget", "label": "Бюджет",
                 "source": "project.budget"},
                {"name": "level_1_percentage", "label": "УГТ 1, %",
                 "source": "questionnaire.level_1.percentage"},
                {"name": "level_2_percentage", "label": "УГТ 2, %",
                 "source": "questionnaire.level_2.percentage"},
                {"name": "level_3_percentage", "label": "УГТ 3, %",
                 "source": "questionnaire.level_3.percentage"},
                {"name": "level_4_percentage", "label": "УГТ 4, %",
                 "source": "questionnaire.level_4.percentage"},
                {"name": "level_5_percentage", "label": "УГТ 5, %",
                 "source": "questionnaire.level_5.percentage"},
                {"name": "level_6_percentage", "label": "УГТ 6, %",
                 "source": "questionnaire.level_6.percentage"},
                {"name": "level_7_percentage", "label": "УГТ 7, %",
                 "source": "questionnaire.level_7.percentage"},
                {"name": "level_8_percentage", "label": "УГТ 8, %",
                 "source": "questionnaire.level_8.percentage"},
                {"name": "level_9_percentage", "label": "УГТ 9, %",
                 "source": "questionnaire.level_9.percentage"},
            ],
        },
    },
    {
        "title": "ТЭО — базовый шаблон",
        "doc_type": "teo",
        "ugt_level": None,
        "raw_text": """ТЕХНИКО-ЭКОНОМИЧЕСКОЕ ОБОСНОВАНИЕ

1. Наименование проекта: {{project_name}}

2. Краткое описание:
   {{project_description}}

3. Техническая часть:
   3.1. Категория: {{project_category}}
   3.2. Текущий уровень готовности: УГТ {{current_level}}
   3.3. Целевой уровень готовности: УГТ {{target_level}}

4. Оценка затрат:
   4.1. Бюджет проекта: {{project_budget}} руб.
   4.2. Распределение по этапам:
   - Этап 1 (УГТ 1–3): {{project_budget_percent_30}} руб.
   - Этап 2 (УГТ 4–6): {{project_budget_percent_40}} руб.
   - Этап 3 (УГТ 7–9): {{project_budget_percent_30}} руб.

5. Оценка эффективности:
   5.1. Достижение УГТ {{target_level}} позволит обеспечить готовность
       технологии к внедрению.
   5.2. Сокращение сроков разработки за счёт структурированного подхода
       ГОСТ Р 58048-2017.
   5.3. Снижение рисков за счёт поэтапного контроля на контрольных точках.

6. Риски проекта:
   - Технические риски несоответствия критериям УГТ.
   - Организационные риски срыва сроков.
   - Финансовые риски превышения бюджета.

7. Заключение:
   Реализация проекта {{project_name}} целесообразна при условии соблюдения
   требований ГОСТ Р 58048-2017 и достижения УГТ {{target_level}}.
""",
        "template_metadata": {
            "variables": [
                {"name": "project_name", "label": "Название проекта",
                 "source": "project.name"},
                {"name": "project_description", "label": "Описание проекта",
                 "source": "project.description"},
                {"name": "project_category", "label": "Категория проекта",
                 "source": "project.category"},
                {"name": "target_level", "label": "Целевой УГТ",
                 "source": "project.target_level"},
                {"name": "current_level", "label": "Текущий УГТ",
                 "source": "project.current_level"},
                {"name": "project_budget", "label": "Бюджет",
                 "source": "project.budget"},
                {"name": "project_budget_percent_30", "label": "30% бюджета",
                 "source": "calculation"},
                {"name": "project_budget_percent_40", "label": "40% бюджета",
                 "source": "calculation"},
            ],
        },
    },
]


async def seed() -> None:
    async with SessionLocal() as db:
        for tmpl in TEMPLATES:
            text = tmpl["raw_text"]
            content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

            from sqlalchemy import select, text

            existing = await db.scalar(
                select(RagDocument).where(
                    RagDocument.content_hash == content_hash,
                    RagDocument.doc_type == tmpl["doc_type"],
                )
            )
            if existing:
                print(f"  SKIP (exists): {tmpl['title']}")
                continue

            doc = RagDocument(
                title=tmpl["title"],
                doc_type=tmpl["doc_type"],
                ugt_level=tmpl["ugt_level"],
                content_hash=content_hash,
                raw_text=text,
                source_uri="seed",
                template_metadata=tmpl["template_metadata"],
                embedding=None,
            )
            db.add(doc)
            await db.commit()
            await db.refresh(doc)

            emb = embed_text(text)
            emb_str = "[" + ",".join(f"{v:.8f}" for v in emb) + "]"

            await db.execute(
                text(
                    "UPDATE public.rag_documents "
                    "SET embedding = :emb::vector WHERE id = :did"
                ),
                {"emb": emb_str, "did": doc.id},
            )
            await db.commit()
            print(f"  OK: {tmpl['title']} (id={doc.id})")

        print("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(seed())
