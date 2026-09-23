# 02 — Воспроизводимое backend test environment (CODE-03)

**Требования:** R05, R20, R21
**Blocked by:** 01
**Зона:** `technozrelost-backend/`
**Волна:** 2
**Status:** ready

## Что должно заработать

В стабилизационном worktree backend-гейты выполняются воспроизводимо из lock-файлов, и у CODE-03 появляется честный итог: либо зелёный сьют на изолированной test-БД, либо зафиксированный BLOCKED с точной ошибкой и документированной командой provisioning. Маскировки нет, код продукта не тронут, production не затронут.

## Из брифа, дословно

> «восстанови зависимости из lock-файлов»
> «не используй голый `uv sync`»
> «используй `uv sync --locked --extra dev`»
> «устрани environment-причины `CODE-03` и `CODE-06`»
> «получи честный baseline тестов»
> «не маскируй ошибки pipeline через `| tail`, `|| true` или аналогичные конструкции»
> «Если тестам требуется PostgreSQL, используй отдельную test schema/database. Никогда не направляй тесты в production.»

## Разделы спецификации

Истории 4–5, 18–19; Решения §2 и §Воспроизводимость; Швы: ruff, mypy, pytest.

## Scope

- `uv sync --locked --extra dev` в `technozrelost-backend/` worktree.
- Поднятие изолированной локальной PostgreSQL test database / test schema (только локально, отдельный процесс/контейнер исполнителя).
- Прогон трёх гейтов с полным выводом: `uv run ruff check app tests infra/alerter scripts/udgu_ingest`, `uv run mypy app`, `uv run pytest -q`.
- Фиксация версий: Python, uv, Node, Docker/Compose, PostgreSQL.
- Если сьюту мешает отсутствие сервиса — честный BLOCKED: точная ошибка, команда устранения, без изменения тестов и продукта.

## Out of scope

- Любые правки продуктового кода (`app/`, `alembic/versions/`, existing tests): найденное продуктовое — вернуть как finding, не чинить.
- Frontend (T03), toolchain-ремонт сверх диагностики (T04), prod-действия, сиды в чужие БД.

## Разрешённые файлы

- Окружение и test-инфра внутри `technozrelost-backend/` (lock-синхронизация, локальная test-DB/конфиг для прогона, `.env.example` — только именами).
- Отчёт тикета текстом. Запрещены: `app/**`, `alembic/versions/**`, любые файлы вне worktree, `spec/manifest/dashboard/state.js`, коммиты.

## Критерии приёмки

- [ ] Зависимости восстановлены строго `uv sync --locked --extra dev` (лог подтверждает флаги).
- [ ] Ruff-гейт: зафиксирован PASS/FAIL целиком, без усечения.
- [ ] Mypy-гейт: зафиксирован итог целиком (включая toolchain-ошибки стабов, если есть).
- [ ] Pytest baseline: полный итог (`N passed, M errors`) + несжатый лог ошибок setup-класса; регрессий продукта ноль либо перечислены.
- [ ] CODE-03: либо зелёный сьют на изолированной test-БД, либо BLOCKED с точной ошибкой (ожидается класс `psycopg.OperationalError` из session autouse-фикстуры) и готовой командой provisioning.
- [ ] Версии Python/uv/Node/Docker/Compose/PostgreSQL зафиксированы в отчёте.
- [ ] Ноль prod-касаний, ноль секретов и ПДн в выводе, продуктовый код не изменён (`git status` worktree показывает только env-следы).

## Команды проверки (выполняет оркестратор при ревью)

```bash
cd .worktrees/production-stabilization/technozrelost-backend
uv run ruff check app tests infra/alerter scripts/udgu_ingest
uv run mypy app
uv run pytest -q
```

## Stop conditions

- Любая попытка соединения с production, чтения `.env`/keys/credential stores, вывода секретов или пользовательских данных — стоп, вернуть BLOCKED-отчёт.
- Необходимость менять lock-файл, продуктовый код или тесты ради «зелени» — стоп, вернуть finding оркестратору вместо маскировки.
