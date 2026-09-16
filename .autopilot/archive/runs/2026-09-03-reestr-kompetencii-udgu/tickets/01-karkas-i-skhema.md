# 01 — Каркас и JSON-схема

**Требования:** R01, R19, R20, R24, R24i
**Blocked by:** —
**Зона:** `technozrelost-backend/docs/udgu_template`, `technozrelost-backend/scripts/udgu_ingest`
**Волна:** 1
**Status:** ready

## Что должно заработать

Создан каркас будущего решения: папки `docs/udgu_template/` и `scripts/udgu_ingest/` с README-заглушками, JSON-схема `udgu_template.schema.json` и Pydantic-модели `models.py`, которые описывают все 7+ разделов выгрузки (кафедры, приоритеты, миссия, оборудование, РИД, услуги, люди + расширяемые). Схема валидна, импортируется без БД, и задаёт единый язык для следующих тасков. Существующие реестры платформы не затронуты.

## Из брифа, дословно

> «У нас есть на платформе реестры компетенций региона»
> «нужен единый машиночитаемый шаблон выгрузки, пригодный для импорта в платформу» (R19i)
> «данные должны лечь в существующие реестры потенциала УР» (R20i)
> «У удгу больше типов данных. Указанные - просто примеры»

## Разделы спецификации

Истории 1, 24, 26, 31; Решения §JSON-схема (`schema/udgu_template.schema.json`), §Стек; Границы `udgu-template`/`udgu-ingest` (каркас); Швы §1.

## Критерии приёмки

- [ ] Папки `technozrelost-backend/docs/udgu_template/` и `technozrelost-backend/scripts/udgu_ingest/` существуют; в каждой — `README.md` с назначением
- [ ] Файл `schema/udgu_template.schema.json` валиден (jsonschema) и покрывает 7 разделов + `raw_refs` + `university` meta
- [ ] `scripts/udgu_ingest/models.py` — Pydantic-модели `UdguImport`, `Department`, `Priority`, `Equipment`, `Patent`, `Service`, `Person` — импортируются (`from scripts.udgu_ingest.models import UdguImport` не падает), поле `trl: 1-9` валидируется, `competencies: list[str]` как в платформе
- [ ] Расширяемость: добавлен `extra_sections: dict[str, list[dict]]` или `additionalProperties` — новый тип `08_...` не ломает схему (тест: JSON с `extra_sections: {"08_custom": [{"name":"x"}]}` валиден)
- [ ] Тест `tests/test_udgu_schema.py` — 3+ кейса: валидный import, невалидный TRL, extra-секция — зелёный
- [ ] Команда `uv run ruff check` и `uv run pytest -q -k udgu_schema` — зелёные; существующие реестры не изменены (нет миграций)
