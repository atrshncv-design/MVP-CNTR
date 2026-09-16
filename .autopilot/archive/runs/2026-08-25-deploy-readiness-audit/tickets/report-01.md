# Отчёт тикета 01 — Зелёная база на актуальной main

## Реестр находок

| id | область | файл:строка | severity | описание | действие |
|----|---------|-------------|----------|----------|----------|
| F-01-01 | infra/БД | `technozrelost-backend/infra/postgres/init-primary.sh` (runtime) | высоко | Роль `replicator` отсутствовала на primary: init-скрипт выполняется только при первой инициализации тома; на существующем томе реплика циклически падала (`pg_basebackup: password authentication failed`) | исправлено — роль создана рантайм-SQL (`CREATE ROLE replicator ... PASSWORD 'replica_pass'`, пароль из compose-переменной REPL_PASSWORD); конфиги compose не менялись. Рекомендация тикету 05: идемпотентная инициализация роли |
| F-01-02 | backend/зависимости | `technozrelost-backend/pyproject.toml:31-38` | низко | pytest входит в `[project.optional-dependencies].dev`; в свежей рабочей копии `uv run pytest` падает («No such file») до `uv sync --extra dev`. Новых зависимостей не добавлялось | исправлено — выполнен `uv sync --extra dev` (объявленные зависимости, ничего нового). Рекомендация: зафиксировать шаг в README/onboarding |
| F-01-03 | frontend/lint | `src/components/achievements/medal.tsx:4`, `landing/level-detail.tsx:7,26,56`, `landing/methodology-content.tsx:12-15`, `landing/ugt-interactive-scale.tsx:99` | низко | 9 предупреждений eslint `no-unused-vars`: неиспользуемые импорты, мёртвая функция `getStageLabel`, неиспользуемая переменная `prevLevel`, неиспользуемый параметр `pi` | исправлено — мёртвый код удалён; lint теперь 0 ошибок / 0 предупреждений |

## Верификация

| Команда | Результат |
|---|---|
| `docker compose -f technozrelost-backend/infra/docker-compose.yml up -d pg-primary pg-replica` | обе БД healthy (primary :5432, replica :5433). Примечание: сервисы в compose называются `pg-primary`/`pg-replica`, а не `db`/`db-replica` из брифа — использованы фактические имена, конфиги не тронуты |
| `cd technozrelost-backend && uv sync --extra dev && uv run pytest -q` | **191 passed**, 4 warnings (deprecation из starlette/fastapi — вне зоны) за 3:32. Первая попытка до sync: ошибка «pytest not found» (см. F-01-02) |
| `cd technozrelost-backend && uv run ruff check app tests` | All checks passed |
| `cd technozrelost-frontend && npm install && npm run lint` | было: 0 errors / 9 warnings → стало: чисто |
| `cd technozrelost-frontend && npm test` | **20 pass / 0 fail** (node:test) |
| `cd technozrelost-frontend && npm run build` | успешно; все роуты собраны (статика + динамика + middleware), ошибок и предупреждений нет |

## Ловушка NextAuth (подтверждение процедуры)

1. Перед сборкой проверено: `lsof -iTCP:3000 -sTCP:LISTEN` — пусто, `pgrep -fl "next dev"` — пусто (dev не запущен).
2. Сборка выполнена при остановленном dev — прошла без ошибок, NextAuth-роуты не пострадали.
3. Ловушка не воспроизводилась намеренно (сборка при живом dev ломает артефакты); рабочая процедура: **остановить dev → убедиться по порту 3000 и процессу → только потом `npm run build`**.

## Исправления (файл:строка, что и зачем)

- `src/components/achievements/medal.tsx:4` — убран неиспользуемый импорт `ComponentType`.
- `src/components/landing/level-detail.tsx:7` — убран неиспользуемый импорт `ArrowLeft`.
- `src/components/landing/level-detail.tsx` (бывш. 26–33) — удалена мёртвая функция `getStageLabel` (не вызывается).
- `src/components/landing/level-detail.tsx` (бывш. 56) — удалена неиспользуемая переменная `prevLevel`.
- `src/components/landing/methodology-content.tsx:12-15` — убраны неиспользуемые иконки `FlaskConical`, `Layers`, `Gauge`, `TrendingUp`.
- `src/components/landing/ugt-interactive-scale.tsx:99` — `(phase, pi)` → `(phase)` (параметр не использовался).

Все правки — внутри зоны таска (`technozrelost-frontend/src`); `.env*` не тронуты; git-история не менялась; коммитов нет.

## Критерии приёмки

- [x] БД для тестов поднята штатным compose проекта (без изменения конфигов)
- [x] Backend pytest — 191 passed; исправлений кода бэкенда не потребовалось
- [x] Frontend: lint, test, build — зелёные (dev-сервер при сборке остановлен)
- [x] Список исправлений приложен (см. выше)
- [x] Изменения не выходят за зону таска
