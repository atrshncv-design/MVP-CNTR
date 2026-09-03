# AGENTS.md  
  
```
# MISSION STATEMENT
Ты — Автономный AI-Агент (Maker / Lead Agent). Твоя задача — разработка и реализация кода цифровой платформы «Технозрелость» (B2B/B2G инфраструктура для ЦНТР по ГОСТ Р 58048-2017).
Твой пользователь выступает ИСКЛЮЧИТЕЛЬНО в роли Functional Validator. Он не пишет код и не правит его руками. Любой запрос пользователя на исправление ошибки означает, что ТЫ должен провести анализ, написать код и протестировать его.

# ARCHITECTURE & STACK
- **Frontend (Уровень приложения):** Next.js (App Router). Существующий код MVP 0 лежит в папке `КОД MVP "0" 210726 - ТОЛЬКО ФРОНТЭНД`. Его нужно адаптировать под новую архитектуру.
- **Backend (Уровень логики и ИИ):** Python + FastAPI. Разделение слоев необходимо для независимого масштабирования и отказоустойчивости.
- **Database (Уровень хранения):** PostgreSQL. 
  - Реляционные данные: Пользователи, Роли, Статусы проектов.
  - Векторные данные (для RAG): Расширение `pgvector`.
- **Инфраструктура:** Разделение БД на Primary (запись) и Replica (чтение). Перед серверами должен стоять балансировщик (Nginx).

# RULES ENFORCEMENT (КРИТИЧЕСКИЕ ЗАПРЕТЫ)
1. **Изоляция:** Вся работа ведется строго в изолированных `git worktrees`. Не ломай ветку `main`.
2. **Базы Данных и Индексы:** 
   - Всегда используй раздельные схемы (schemas), например `public` для продакшена и `test` для тестирования гипотез.
   - Для идентификаторов (ID) используй тип `Serial` (или `BigSerial`) для автогенерации последовательностей (sequences).
   - При проектировании таблиц обязательно создавай индексы: используй **Hash Index** для точного поиска (например, по ID или конкретному email) и **B-Tree Index** по умолчанию для запросов с неравенствами (например, возраст или диапазоны дат).
3. **Безопасность (152-ФЗ и ВПК):** Защита от SQL-инъекций обеспечивается строгим использованием ORM (Prisma/Drizzle для Next.js, SQLAlchemy для Python). Для аутентификации используй NextAuth.js.
4. **Контракт Автономности:** Установлен жесткий лимит — 25 итераций на одну задачу. В случае зацикливания рассуждений (Stall Detection) или падения тестов — немедленно остановись и запроси помощь у Functional Validator.
5. **Атомарная память:** После каждого успешного шага ТЫ ОБЯЗАН обновить файл `Status.md`. Контекст следующих шагов читай из `Plan.md`.
6. **Удалённый репозиторий (Push-контракт):** Все зафиксированные изменения (коммиты) должны в обязательном порядке отправляться (push) в удаленный репозиторий: `https://github.com/atrshncv-design/MVP-CNTR.git`. Remote命名为 `origin` (если ещё не задан). Запрещено оставлять локальные коммиты не отправленными.

```

<!-- autopilot:start -->
# Платформа «Технозрелость» + Реестр УдГУ — памятка агенту (tier T2, верифицировано 2026-09-03)

B2B/B2G платформа ЦНТР по ГОСТ Р 58048-2017 + выгрузка УдГУ для реестра потенциала УР. Стек: Next.js 16 + FastAPI + PostgreSQL 16/pgvector + MinIO/ClamAV/Redis/nginx. УдГУ-модуль — офлайн CLI без БД: `openpyxl==3.1.5` + `pandas==2.2.3` + `pydantic==2.13.4`. Память — из кода и `interfaces.md` (`.autopilot/2026-09-03-reestr-kompetencii-udgu/interfaces.md`), не из spec/tickets.

## Заголовок и строка
Tier T2, slug `reestr-kompetencii-udgu`, 25 требований (R01-R25), 4 таска 3 волны (1+2+1), mode `semi`. Модули: `udgu-template` (шаблон+схема+ТЗ), `udgu-ingest` (CLI), `udgu-mapping` (документация маппинга). Шов — CLI чёрный ящик ZIP→JSON, без БД.

## Команды (копипастом, верифицировано 2026-09-03)
- **Deps dry-run (не ломать dev-зависимости):** `cd technozrelost-backend && uv sync --extra dev --dry-run` → `Would make no changes`. Голый `uv sync` без `--extra dev` сносит pytest/ruff/mypy — запрещён.
- **Тесты UdGU (25 passed):** `cd technozrelost-backend && uv run pytest -q -k udgu` → `25 passed, 362 deselected` (8.3s). Детально: `cd technozrelost-backend && uv run pytest tests/test_udgu_schema.py tests/test_udgu_template.py tests/test_udgu_ingest.py tests/test_udgu_e2e.py -v`
- **CLI help:** `cd technozrelost-backend && uv run python -m scripts.udgu_ingest.ingest --help` → `--zip ZIP_PATH --out OUT_DIR` (аналог `python3 -m scripts.udgu_ingest.ingest --help`). Exit 0.
- **Линт ingest:** `cd technozrelost-backend && uv run ruff check scripts/udgu_ingest docs/udgu_template` → `All checks passed!` (на `docs/udgu_template` — `No Python files`, норма). Полный: `cd technozrelost-backend && uv run ruff check .` (E501 в старых `alembic/versions/0007*` — вне зоны UdGU).
- **Full ingest (пример архива):** `cd technozrelost-backend && uv run python -m scripts.udgu_ingest.ingest --zip docs/udgu_template/example/УдГУ_потенциалУР_2026-09-03.zip --out /tmp/udgu_out && ls -1 /tmp/udgu_out` → `udgu_import.json` `report.json` `report.md` `warnings.log` (идемпотентно — перезапись). Проверка: `cat /tmp/udgu_out/report.md | head -n 20` содержит `Отчёт по выгрузке УдГУ 2026-09-03`.
- **Фронт (не трогать в этом прогоне):** `cd technozrelost-frontend && npm run lint && npm test` (если нужен).

## Ключевые файлы
- **Схема/модели (владелец таск 01):** `technozrelost-backend/scripts/udgu_ingest/models.py:152` — `from scripts.udgu_ingest.models import UdguImport, Department, Priority, Equipment, Patent, Service, Person` — единственная точка импорта. `UdguImport { university, departments, priorities, mission?, equipment, patents, services, people, raw_refs, extra_sections }`, `competencies: list[str]`, `trl: int ge=1 le=9`, `extra_sections: dict[str,list[dict]]`, `model_config extra=allow` (корень) / `forbid` (вложенные). Инициализация пакета — `technozrelost-backend/scripts/udgu_ingest/__init__.py:1` реэкспортит 7 моделей. Дока — `technozrelost-backend/scripts/udgu_ingest/README.md:1`.
- **CLI-пайплайн (таски 03+04):** `technozrelost-backend/scripts/udgu_ingest/ingest.py:1` — `ingest.py --zip <zip> --out <dir>` → 4 файла. Ключевые функции: `_normalize_folder()` (lower без пробелов/дефисов), `_norm_key()`, `_resolve_section()` (маппинг по цифрам 01-07, 99, 08/09→extra), `_process_workbook()`, `_process_zip_to_outputs()`, `_write_outputs()`, `_extract_report_date()` (дата из имени ZIP `YYYY-MM-DD` или today). Константы: `MAX_ROWS_PER_SHEET=10000`, `MAX_YEAR=2026`.
- **Шаблон (таск 02):** `technozrelost-backend/docs/udgu_template/00_опись.xlsx` (30K, 9 листов: `00_инструкция`, `01_кафедры_лаб`, `02_приоритеты_заделы`, `03_миссия_фронтир`, `04_оборудование`, `05_РИД`, `06_услуги_МСП`, `07_люди_эксперты`, `99_raw_опись`; заголовки +1 пример строки + комментарии-подсказки + DataValidation). `docs/udgu_template/00_опись.pdf` (6.1K, `%PDF` placeholder с ссылкой на .md). `docs/udgu_template/README.md:1` — краткий обзор состава.
- **ТЗ и маппинг:** `technozrelost-backend/docs/udgu_template/README_УдГУ_выгрузка.md:1` (285 строк: цель, физформа ZIP, 7 разделов с обязательностью `*`, правило «таблички — ядро, документы — приложения», §5 расширяемость `08_...`, §6 `нет данных`, Wave1(01,04,05,07)/Wave2, конвенция `УдГУ_потенциалУР_YYYY-MM-DD.zip`, §9 таблица маппинга). `technozrelost-backend/docs/udgu_template/mapping.md:1` (таблица полей → `UdguImport` → реестры `app/db/models.py` + 3 примера JSON до/после + связь с верификацией).
- **Схема JSON:** `technozrelost-backend/docs/udgu_template/schema/udgu_template.schema.json:1` (Draft 2020-12, `additionalProperties: true`, `$defs` 10 моделей, `trl 1-9`, `year 1900-2100`, `competencies array string`) + дубль `technozrelost-backend/schema/udgu_template.schema.json:1` (тест `test_udgu_schema_json_schema_file_is_valid` проверяет оба пути).
- **Пример архива:** `technozrelost-backend/docs/udgu_template/example/УдГУ_потенциалУР_2026-09-03.zip` (47K, 15 files, `zip.testzip()==None`): в корне `00_опись.xlsx` + `README.md`+`README_УдГУ_выгрузка.md`, папки `01_кафедры_и_лаборатории/` `02_приоритеты_и_заделы/` `03_миссия_фронтир/` `04_оборудование/` `05_РИД_патенты_публикации/` `06_услуги_МСП/` `07_люди_эксперты/` `08_extra_example/` `raw/` — каждая ≥1 файл.
- **Зависимости:** `technozrelost-backend/pyproject.toml:39` — `openpyxl==3.1.5`, `pandas==2.2.3`, `pydantic==2.13.4`, `ruff line-length 100`, `mypy --strict`, `pytest asyncio_mode=auto pythonpath=[.]`.
- **Платформа (не трогать):** `technozrelost-backend/app/core/config.py:11` + `app/core/database.py:1` (Primary :5432 / Replica :5433, `get_db`/`get_read_db`), `app/main.py:1` (~25 роутеров), `app/db/models.py`, `infra/docker-compose.yml` (pg-primary/pg-replica/minio/clamav) и `docker-compose.prod.yml`, `technozrelost-frontend/next.config.ts:1` + `src/lib/roles.ts:46`.

## Архитектура
- **Платформа:** browser → `nginx:443` → `frontend:3000` / `backend:8000` (×2 реплики). Primary запись, Replica чтения (`get_read_db`). Auth JWT HS256 + NextAuth Credentials, MinIO+ClamAV fail-closed, nh3 санитайз, CSP+HSTS. Подробнее — предыдущая память T1 (не дублируется).
- **UdGU-выгрузка (офлайн, без БД/деплой):** ZIP `УдГУ_потенциалУР_YYYY-MM-DD.zip` по папкам → `ingest.py` → `udgu_import.json` (pydantic) + `report.md` + `report.json` + `warnings.log` в `--out` (идемпотентно, перезапись). Excel — ядро (только `00_опись.xlsx` парсится, `00_инструкция` пропускается), файлы в папках (`raw/` + тематические + `08_...`) → `raw_refs` (индекс). Нормализация `_normalize_folder` + `_resolve_section` маппит `01_Кафедры и Лаборатории` ≡ `01_кафедры_лаб` (lower без пробелов/дефисов, префикс цифр). Валидация: обязательные `название`/`ФИО*` → warning `лист 04 строка 3: поле название — обязательно`; TRL 1-9 (B-Tree) → `лист 02 строка X: поле TRL 99 вне диапазона 1-9` и сброс `trl=None`; год 1900-2026 (B-Tree) → `год ожидается 1900-2026` + `year=None`; Hash-дедуп по `тип+норм.название+год` → `дубликат 04 строка 3 и 5 объединены` (оставляет первую, пропускает дубли); лимит 10k строк/лист → `превышен лимит 10k, обработано 10000` (обрезка `MAX_ROWS+1` заголовок). Устойчивость: битый ZIP/CRC → `архив повреждён: файл X не читается` + минимальный валидный JSON, нечитаемый Excel → warning `нечитаемый Excel`, пустая папка/лист → `раздел 03: нет данных` (валидно, не падение). Расширяемость R24: любая папка/лист `08_*`/`09_*` → `extra_sections["08_доп_тип"]` без изменения кода. Отчёт: заголовок `Отчёт по выгрузке УдГУ YYYY-MM-DD` (дата из имени ZIP), таблица `%` заполненности по 7 разделам (100/0, `overall 0-100%`), `Пустые разделы` с `раздел 03: нет данных`, `Сырые файлы` с `Найдено файлов: N` + список до 80 + сводка по префиксам, `Ошибки по строкам` (фильтр `лист+строка`), `Wave2 — что доделать` + `raw_refs` сводка. `report.json` — машинная копия (`counts`, `completeness_percent`, `empty_sections`, `warnings`, `raw_refs_count`, `wave2_todo`).

## Соглашения
- **ID/индексы:** в этом прогоне БД-миграций нет; для отчётов — Hash для точного (дедуп) и B-Tree для диапазонов (1900-2026, 1-9, 2000-2100). В платформе — `Serial`/`BigSerial`, Hash для exact, B-Tree default.
- **Типы UdGU:** `competencies: list[str]` как `app/db/models.py:competencies` (через `;` в Excel), `trl ge=1 le=9`, `year ge=1900 le=2026`, `available_for_sme: bool` (`Да/Нет` → `_parse_bool`), `extra_sections` + `additionalProperties: true`.
- **Безопасность/изоляция:** ORM (SQLAlchemy) + NextAuth.js (платформа), `scripts/udgu_ingest` без БД; работа строго в `git worktrees`, не ломать `main`; push в `origin https://github.com/atrshncv-design/MVP-CNTR.git`.
- **Не трогать:** `technozrelost-backend/app/`, `alembic/`, `technozrelost-frontend/`, `infra/docker-compose*.yml`, `.autopilot/state.js` (только чтение). Зоны тасков изолированы.
- **Стиль:** `uv` + `ruff` (E/F/I/UP/B/SIM, line-length 100), `mypy --strict`, комментарии/докстринги по-русски «почему», `pydantic>=2.5`.
- **Секреты:** только именами переменных в `.env.example`, никогда в код/коммиты/логи.
- **BLOCKED:** недостающая зависимость → `BLOCKED: <имя>` + причина, не ставить молча.

## Окружение (только имена, без значений)
- **Backend `.env` (`app/core/config.py` + `.env.example`):** `APP_ENV` (dev/test/production), `POSTGRES_USER/PASSWORD/DB/HOST/PORT`, `POSTGRES_REPLICA_HOST/PORT` / `DATABASE_URL`/`DATABASE_REPLICA_URL`, `DB_SCHEMA_PUBLIC/DB_SCHEMA_TEST`, `DB_POOL_SIZE/DB_MAX_OVERFLOW/DB_APP_REPLICAS/DB_MAX_CONNECTIONS/DB_CONNECTIONS_RESERVE`, `VECTOR_DIMENSION`, `JWT_SECRET/JWT_ALGORITHM/ACCESS_TOKEN_TTL_MINUTES/REFRESH_TOKEN_TTL_DAYS/CORS_ORIGINS`, `REDIS_URL`, `RATE_LIMIT_*`, `LLM_API_BASE/LLM_API_KEY/LLM_MODEL`, `MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/SECURE`, `CLAMAV_HOST/PORT/CLAMAV_ENABLED`, `MAX_FILE_SIZE_MB/MAX_REQUEST_BODY_MB`.
- **Prod `infra/.env.production.example`:** `REPL_USER/REPL_PASSWORD/REPL_SLOT`, `NEXTAUTH_URL/SECRET`, `API_URL_INTERNAL/NEXT_PUBLIC_API_URL`, `GRAFANA_*`, `BACKUP_*`/`WAL_OFFSITE_*`, `ALERTER_*`, `TELEGRAM_BOT_TOKEN/CHAT_ID`, `IMAGE_TAG`.
- **Frontend `.env.example`:** `AUTH_SECRET/AUTH_URL`, `API_URL_INTERNAL`, `NEXT_PUBLIC_API_URL`.
- **UdGU-прогон:** переменных нет — только файловые пути `--zip`/`--out`; `PYTHONPATH=.` (из `technozrelost-backend`, `pyproject.toml: pythonpath=[.]`).

## Тесты (25 passed, швы — публичные границы)
- **`tests/test_udgu_schema.py` (4):** `test_udgu_schema_valid_import_accepts_known_payload`, `invalid_trl_rejected` (0/10/99 → ValidationError, 1/9 ok), `extra_sections_allows_custom_08`, `json_schema_file_is_valid` (оба пути схемы, `competencies array`, `trl 1-9`).
- **`tests/test_udgu_template.py` (5):** `files_exist` (xlsx/pdf/README/schema/ZIP + `%PDF`), `xlsx_opens_and_has_sheets` (≥9, все 00/01..07/99), `headers_example_and_validation` (подстроки заголовков, пример строки >10, ≥2 comments, DataValidation в 02/04/05/03, инструкция содержит `нет данных`), `readme_contains_required_sections` (14 ключевых фраз + `Equipment`/`competencies`), `example_zip_unpacks_and_has_folders` (9 префиксов, extractall ≥10 файлов, `00_опись.xlsx` валиден).
- **`tests/test_udgu_ingest.py` (10):** CLI чёрный ящик `subprocess python -m scripts.udgu_ingest.ingest --zip --out` без БД. `happy_path_example_zip` (4 файла, `raw_refs ≥8` с `raw/`+`01_`); `cli_help_works` (`--zip`/`--out`); `empty_archive_is_valid` + `empty_zip_no_xlsx` (sentinel `нет данных` → `раздел 03: нет данных`, все `[]`); `broken_archive_logs_warning` (мусор → `архив повреждён`+`не читается`, return 0, no Traceback); `unreadable_excel_warns`; `duplicate_equipment_dedup` (3 одинаковых →1 + `дубликат`); `invalid_trl_warns`; `missing_required_name_warns`; `normalizes_folder_names` (две папки с разным регистром/пробелами → обе в `raw_refs`, исходник содержит `_normalize_folder`+`lower`).
- **`tests/test_udgu_e2e.py` (6):** `example_zip_full_pipeline` (проверка всех секций `report.md`: заголовок+дата 2026-09-03, `%`, `Заполненность`, `Пустые разделы`, `Найдено файлов`, `raw_refs` сводка, `Ошибки по строкам`/`Wave2`); `idempotent_second_run_overwrites` (json/md идентичны, 4 файла, no дубликаты); `extensibility_extra_section_copied_from_example` (копия ZIP+лист `08_доп_тип` 2 строки → `extra_sections["08_доп_тип"]==2` + файлы в `raw_refs`); `year_out_of_range_warns` (3026 → `год ожидается 1900-2026`, `year=None`); `dedup_equipment_combined` (3 дубля →1); `limit_10k_warns` (10001 строк → `превышен лимит 10k, обработано 10000`, `len==10000`).
- Запуск: `cd technozrelost-backend && uv run pytest -q -k udgu` или `uv run pytest tests/test_udgu_*.py -v`. DB не требуется (в отличие от `tests/conftest.py` для остальных 57 файлов платформы).

## Структура и география репозитория
- **Моно-репозиторий с worktrees:** remote `origin https://github.com/atrshncv-design/MVP-CNTR.git`, ветка `main @ a8f85c6` (не коммитить). Текущий чекаут — корень `Технозрелость/`. `.autopilot/` — спеки/состояние (`state.js` tier T2 slug `reestr-kompetencii-udgu`), `manifest.md`, `spec.md`, `interfaces.md`, `dashboard.html`.
- **Backend канонический `technozrelost-backend/`:** `scripts/udgu_ingest/{ingest.py,models.py,README.md}` + `docs/udgu_template/{00_опись.xlsx,00_опись.pdf,README.md,README_УдГУ_выгрузка.md,mapping.md,schema/udgu_template.schema.json,example/УдГУ_потенциалУР_2026-09-03.zip}` + дубль `schema/udgu_template.schema.json` + `tests/test_udgu*.py` (69 тестов всего в `tests/`). Остальное — `app/`, `alembic/versions/0001…0032`, `infra/docker-compose.yml|prod.yml`, `pyproject.toml`.
- **Frontend `technozrelost-frontend/`:** `next.config.ts`, `src/lib/{public-api.ts,roles.ts,api-client.ts}`, `src/app/(landing)/` и `src/app/dashboard/<роль>/` (8 ЛК), `tests/*.test.mjs`.
- **Графы:** `.graphify/` (`graph.json`, `GRAPH_REPORT.md`) — первый шаг `graphify query`.

## Подводные камни
- `uv sync` без `--extra dev` удаляет dev-зависимости — всегда `--extra dev` (проверено `interfaces.md:25`).
- CLI пути относительны `technozrelost-backend` как CWD (`pythonpath=[.]`): `docs/udgu_template/...` резолвится только из `technozrelost-backend`; из корня — `technozrelost-backend/docs/...`.
- `python` может отсутствовать (zsh `command not found: python`) — используй `python3` или `uv run python`; оба `python3 -m scripts.udgu_ingest.ingest` и `uv run python -m scripts...` работают.
- `ruff check docs/udgu_template` → `No Python files` — не ошибка; зона UdGU без python, проверяй `scripts/udgu_ingest`.
- Excel sentinel `нет данных` в первом столбце — только так раздел считается пустым; пустые строки пропускаются, но отсутствие листа ≠ пустота (тест `empty_zip_no_xlsx` — отсутствие xlsx валидно).
- Дата отчёта берётся из имени ZIP `YYYY-MM-DD` (regex `\d{4}-\d{2}-\d{2}`), фолбэк `today` — детерминизм для тестов (`2026-09-03` в `example_zip_full_pipeline`).
- Дедуп Hash чувствителен к `_norm_key` (lower без пробелов/дефисов/подчёркиваний): `Микроскоп` и `Микроскоп ` — дубликат; год различает (`оборудование: тип+имя+год`).
- Лимит 10k — `ws.max_row > 10001` → warning + обрезка по `r_idx > 10001`; тест генерирует 10001 данных +1 заголовок → ровно 10000 в `departments`.
- `__MACOSX` и папки `__*` фильтруются из `raw_refs`; корневые README/pdf не индексируются как `raw`.
- `00_опись.pdf` — placeholder, начинается с `%PDF`; не парсится ingest, только для людей.
- Не коммитить самостоятельно — оркестратор коммитит; историю `main` не переписывать; `.env*` значения не в логи/отчёты.

## Как здесь работает Autopilot
- Проект — платформа «Технозрелость» (ГОСТ Р 58048-2017) + выгрузка УдГУ (реестр потенциала УР). Сборка навыком `/autopilot` (требования→spec→tickets в `.autopilot/2026-09-03-reestr-kompetencii-udgu/`, прогресс `dashboard.html` + `state.js`). Требование из `manifest.md` снимает только пользователь.
- Текущий прогон: tier T2, 25 требований, 4 таска 3 волны (01 каркас+схема → 02 шаблон+ТЗ + 03 ingest параллельно → 04 отчёты/валидация/маппинг). Все 4 `done` (коммиты `20d04b7` `ec4979c` `0401d83` `9d1f822`), review passed, `final active`. Следующий агент — читает `.autopilot/state.js` и `.autopilot/2026-09-03-reestr-kompetencii-udgu/interfaces.md` (модули/швы/правила), затем код; запустить «продолжи автопилот» — состояние поднимется без расспросов.
<!-- autopilot:end -->
