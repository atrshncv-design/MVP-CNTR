"""Тесты шва udgu-template: схема и Pydantic-модели — публичный интерфейс.

Почему на шве: проверяем файл схемы и валидацию через публичный импорт
`from scripts.udgu_ingest.models import UdguImport`, без БД и внутренностей.
Ожидаемые значения — разобранный вручную пример, не вычисленный кодом под тестом.
"""

from __future__ import annotations

import json
import pathlib

import pytest
from pydantic import ValidationError

from scripts.udgu_ingest.models import (
    Department,
    Equipment,
    Patent,
    Person,
    Priority,
    Service,
    UdguImport,
)


def _valid_payload() -> dict:
    """Минимальный валидный пример — вручную разобранный, не из кода под тестом.

    7 разделов + raw_refs + university meta, competencies как list[str], trl 1-9.
    """
    return {
        "university": {"name": "Удмуртский государственный университет", "short_name": "УдГУ"},
        "departments": [
            {"name": "Кафедра ИИ", "faculty": "ИМИТ", "competencies": ["AI/ML", "НИОКТР"]},
        ],
        "priorities": [
            {"title": "Квантовые коммуникации", "trl": 4, "competencies": ["кванты"]},
        ],
        "mission": {
            "mission_text": "Фронтир в Удмуртии",
            "frontier": ["ИИ", "материалы", "био"],
            "strategy_until": 2030,
        },
        "equipment": [
            {"name": "Микроскоп", "year": 2021, "competencies": ["микроскопия"]},
        ],
        "patents": [
            {"title": "Способ синтеза", "kind": "патент", "number": "RU123", "competencies": []},
        ],
        "services": [
            {"name": "Консалтинг МСП", "format": "консалт", "competencies": ["консалтинг"]},
        ],
        "people": [
            {"full_name": "Иванов И.И.", "position": "доцент", "competencies": ["AI/ML"]},
        ],
        "raw_refs": [{"file": "raw/dump.pdf", "description": "сырой дамп"}],
        "extra_sections": {},
    }


def test_udgu_schema_valid_import_accepts_known_payload() -> None:
    """Валидный импорт с 7 разделами + raw_refs + university — принимается."""
    payload = _valid_payload()
    # публичный интерфейс — pydantic валидация
    obj = UdguImport.model_validate(payload)
    # известные величины из примера, не вычисленные кодом
    assert obj.university.name == "Удмуртский государственный университет"
    assert obj.departments[0].name == "Кафедра ИИ"
    assert obj.priorities[0].trl == 4
    assert obj.people[0].full_name == "Иванов И.И."
    assert obj.raw_refs[0].file == "raw/dump.pdf"
    # серийный круг — dump и повторная валидация
    dumped = obj.model_dump()
    again = UdguImport.model_validate(dumped)
    assert again == obj


def test_udgu_schema_invalid_trl_rejected() -> None:
    """TRL вне 1-9 — отклоняется (границы B-Tree диапазона)."""
    payload = _valid_payload()
    # вручную пробуем невалидные значения 0 и 10 — известные границы
    for bad_trl in (0, 10, 99):
        payload["priorities"] = [{"title": "Задел", "trl": bad_trl}]
        with pytest.raises(ValidationError) as exc:
            UdguImport.model_validate(payload)
        # ошибка должна упоминать trl/ le/ge — проверяем сообщение, не внутренности
        assert "trl" in str(exc.value).lower()

    # валидные границы 1 и 9 — должны приниматься
    for good_trl in (1, 9):
        payload["priorities"] = [{"title": "Задел", "trl": good_trl, "competencies": []}]
        obj = UdguImport.model_validate(payload)
        assert obj.priorities[0].trl == good_trl


def test_udgu_schema_extra_sections_allows_custom_08() -> None:
    """Расширяемость: extra_sections с 08_custom — не ломает схему."""
    payload = _valid_payload()
    payload["extra_sections"] = {"08_custom": [{"name": "x", "value": 42}]}
    obj = UdguImport.model_validate(payload)
    assert "08_custom" in obj.extra_sections
    assert obj.extra_sections["08_custom"][0]["name"] == "x"

    # также пустой extra_sections — валидно
    payload["extra_sections"] = {}
    obj2 = UdguImport.model_validate(payload)
    assert obj2.extra_sections == {}

    # competencies как list[str] — проверяем тип из платформы
    dept = Department(name="Кафедра", competencies=["AI/ML", "био"])
    assert dept.competencies == ["AI/ML", "био"]
    # неверный тип competencies — должен отклониться
    with pytest.raises(ValidationError):
        Department.model_validate({"name": "Кафедра", "competencies": "не список"})  # type: ignore[arg-type]


def test_udgu_schema_json_schema_file_is_valid() -> None:
    """Файл schema/udgu_template.schema.json существует и валиден как JSON Schema."""
    candidates = [
        pathlib.Path("docs/udgu_template/schema/udgu_template.schema.json"),
        pathlib.Path("schema/udgu_template.schema.json"),
    ]
    existing = [p for p in candidates if p.exists()]
    assert existing, "схема не найдена ни в docs/udgu_template/schema/ ни в schema/"
    for path in existing:
        data = json.loads(path.read_text(encoding="utf-8"))
        # известные ключи — 7 разделов + raw_refs + university
        props = data.get("properties", {})
        keys = (
            "university",
            "departments",
            "priorities",
            "equipment",
            "patents",
            "services",
            "people",
            "raw_refs",
        )
        for key in keys:
            assert key in props, f"в схеме отсутствует {key}"
        # extra_sections или additionalProperties — расширяемость
        assert "extra_sections" in props or data.get("additionalProperties") is True
        # competencies как array of strings — проверяем на примере Department
        dept_schema = data.get("$defs", {}).get("Department", {})
        comp = dept_schema.get("properties", {}).get("competencies", {})
        assert comp.get("type") == "array"
        assert comp.get("items", {}).get("type") == "string"
        # trl 1-9 в Priority
        priority_schema = data.get("$defs", {}).get("Priority", {})
        trl = priority_schema.get("properties", {}).get("trl", {})
        # trl может быть anyOf с integer 1-9 и null
        trl_str = json.dumps(trl, ensure_ascii=False)
        assert "1" in trl_str and "9" in trl_str

    # импорт моделей без БД — не падает (шов ingest каркас)
    assert UdguImport is not None
    assert Department is not None
    assert Priority is not None
    assert Equipment is not None
    assert Patent is not None
    assert Service is not None
    assert Person is not None
