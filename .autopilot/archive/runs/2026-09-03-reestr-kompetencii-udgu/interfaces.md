# Границы, решённые в спецификации

Скопировано из spec §Границы и швы — до нарезки тасков. Единственный источник правды для субагентов.

## Модули

| Модуль | Владеет | Выставляет | Прячет |
|--------|---------|------------|--------|
| `udgu-template` | Excel-шаблон `00_опись.xlsx`, JSON-схема `schema/*.json`, ТЗ `README_УдГУ_выгрузка.md`, пример архива `example/УдГУ_*.zip` | `00_опись.xlsx` (7 листов + 00_инструкция + 99_raw_опись), `schema/udgu_template.schema.json`, `README_УдГУ_выгрузка.md`, `example/` | вёрстка Excel, детали валидации ячеек, комментарии |
| `udgu-ingest` | CLI-пайплайн normalize+validate+report | `scripts/udgu_ingest/ingest.py --zip <path> --out <dir>` → `udgu_import.json` (pydantic), `report.md`, `report.json`, `warnings.log` | парсинг openpyxl/pandas, нормализацию имён папок/листов, Hash-дедуп, B-Tree валидацию дат |
| `udgu-mapping` | Документация маппинга на реестры платформы | таблица маппинга `mapping.md` + раздел в README | детали ORM `app/db/models.py`, Alembic |

## Швы для тестов (публичные границы)

- `udgu-template`: файлы существуют + Excel открывается (openpyxl) + листы на месте + JSON-схема валидна (jsonschema/pydantic).
- `udgu-ingest`: CLI как чёрный ящик — на вход ZIP, на выход JSON+отчёты, без БД, проверка через файловую систему.

Предпочтительный шов — `udgu-ingest` CLI (один). Число швов минимально.

## Правила проекта (для субагентов)

- **Стек:** Python 3.11+, FastAPI (backend), PostgreSQL 16 + pgvector (не трогать в этом прогоне), Next.js 16 (не трогать). Для этого прогона — `openpyxl`, `pandas`, `pydantic>=2`, `typer`/`click`, `pytest`.
- **Версии:** `openpyxl>=3.1`, `pandas>=2.0`, `pydantic>=2.5`. Не ставить `next-intl` и т.п. — вне зоны.
- **Команды:**
  - Установка (проверка): `cd technozrelost-backend && uv sync --extra dev --dry-run` (не `uv sync` без --extra)
  - Тесты: `cd technozrelost-backend && uv run pytest -q` (или `uv run pytest tests/test_udgu_*.py -v`)
  - Линт: `cd technozrelost-backend && uv run ruff check .`
  - Фронтенд не трогать.
- **Что не трогать:** `technozrelost-backend/app/` (кроме чтения), `technozrelost-backend/alembic/`, `technozrelost-frontend/`, `infra/docker-compose*.yml`, `.autopilot/state.js` (только оркестратор).
- **Зоны тасков:** каждый таск пишет только в свою зону (см. tickets). Пересечение в одной волне — запрещено.
- **BLOCKED:** недостающая зависимость/доступ → вернуть `BLOCKED: <имя пакета>` + причина, не ставить молча.
- **Секреты:** не запрашивать, не писать в код/коммиты; только имена переменных в `.env.example`.
- **ID/индексы:** не применимо (нет БД-миграций в этом прогоне); для отчётов — Hash для точного, B-Tree для диапазонов (валидация).
- **Язык:** комментарии/докстринги — по-русски, объясняют «почему».

## Из таска 01 — Каркас и JSON-схема

- `from scripts.udgu_ingest.models import UdguImport, Department, Priority, Equipment, Patent, Service, Person` — единственная точка импорта схемы
- `UdguImport { university: str, departments: list[Department], priorities: list[Priority], mission: Mission|None, equipment: list[Equipment], patents: list[Patent], services: list[Service], people: list[Person], raw_refs: list[str], extra_sections: dict[str, list[dict]] }` — владелец схемы — таск 01
- `competencies: list[str]` — как в платформе (`app/db/models.py:competencies`), `trl: int ge=1 le=9`
- Файлы: `technozrelost-backend/docs/udgu_template/schema/udgu_template.schema.json` (Draft 2020-12, `additionalProperties: true`) + дубль `technozrelost-backend/schema/udgu_template.schema.json`; тесты: `pytest -k udgu_schema` → 4 passed; ruff на зоне — clean
- Тесты: `tests/test_udgu_schema.py` — валидный, невалидный TRL, extra-секция

## Из таска 02 — Шаблон Excel и ТЗ для УдГУ

- `docs/udgu_template/00_опись.xlsx` — 9 листов: `00_инструкция`, `01_кафедры_лаб`, `02_приоритеты_заделы`, `03_миссия_фронтир`, `04_оборудование`, `05_РИД`, `06_услуги_МСП`, `07_люди_эксперты`, `99_raw_опись`; заголовки + 1 пример строки + комментарии-подсказки + DataValidation (списки/даты) + поле `файл_приложение`
- `docs/udgu_template/README_УдГУ_выгрузка.md` — цель (реестр потенциала УР), физформа ZIP по папкам, 7 разделов с обязательностью, правило «таблички — ядро, документы — приложения», инструкция `08_...` расширяемости, чек-лист Wave1 (01,04,05,07) vs Wave2, конвенция `УдГУ_потенциалУР_YYYY-MM-DD.zip`, таблица маппинга на реестры
- `docs/udgu_template/00_опись.pdf` — экспорт инструкции (placeholder с ссылкой на .md)
- `docs/udgu_template/example/УдГУ_потенциалУР_2026-09-03.zip` — пример архива: в корне README+00_опись.xlsx, папки `01_...`…`07_...` + `raw/` + `08_extra_example/` (демо), в каждой по 1 файлу
- Тесты: `tests/test_udgu_template.py` → 5 passed (проверка листов/заголовков/example ZIP); `pytest -k udgu` → 9 passed; `pyproject.toml` — добавлены `openpyxl==3.1.5`, `pandas==2.2.3`

## Из таска 03 — Пайплайн ingest core

- `scripts/udgu_ingest/ingest.py --zip <zip> --out <dir>` → `udgu_import.json` (валидный по схеме) + `report.json` + `report.md` + `warnings.log`; CLI `--help` работает
- `_normalize_folder()`, `_norm_key()`, `_resolve_section()` — нормализация имён папок/листов (lowercase без пробелов/дефисов)
- Валидация: обязательные поля (лист 04 `название`), TRL 1-9 (B-Tree), Hash-дедуп по `(тип+нормализованное название+год)`, сырые файлы `raw_refs` из `raw/` + тематических папок
- Устойчивость: битый ZIP (CRC) → warning «архив повреждён», нечитаемый Excel → warning, пустая папка/лист → «раздел 03: нет данных» (не падение)
- Тесты: `tests/test_udgu_ingest.py` → 10 passed; ruff на зоне — clean

## Из таска 04 — Отчёты, валидация, маппинг и финальная полировка

- CLI `ingest.py --zip --out` → `udgu_import.json`+`report.md`+`report.json`+`warnings.log` (отчёт: заголовок `Отчёт по выгрузке УдГУ YYYY-MM-DD`, таблица `%` заполненности, пустые разделы, raw-список+count, ошибки по строкам, Wave2 план, raw_refs сводка; report.json — машинная копия)
- `docs/udgu_template/mapping.md` — таблица маппинга полей шаблона на модели платформы (organizations, competencies, equipment, patents, services, people) с примером JSON до/после
- Валидация: дедуп Hash по (тип+имя+год) → warning «дубликат», B-Tree год 1900-2026, лимит 10k строк → warning «превышен лимит 10k»
- Тесты: `tests/test_udgu_e2e.py` → 6 passed; всего `pytest -k udgu` → 25 passed (4+5+10+6)
