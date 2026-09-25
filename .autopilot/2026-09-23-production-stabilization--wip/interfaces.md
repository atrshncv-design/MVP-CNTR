# Границы и швы (seed из spec §Границы и швы + правила прогона)

## Границы, решённые в спецификации

- `test-env` — владеет воспроизводимостью гейтов; наружу: команды гейтов и их итог.
- `access` — владеет правилом «роль+владение+приглашение», УГТ-переходы, верификация; наружу: RBAC/ownership/invitation/IDOR regression-тесты.
- `public-surface` — витрина, CORS, политика docs; наружу: публичные пробы и тесты полей/заголовков.
- `ai-controls` — лимиты/квоты/breaker/валидация/метрики AI, PII-гейт; наружу: поведение при превышении и `malformed_total`.
- `data-safety` — индексы, at-rest, backup/restore; наружу: проверки, marker/retention/alert, rehearsal-отчёт.
- `hardening` — non-root/capabilities/read-only, пресеты dev/test/prod; наружу: воспроизводимый compose-результат.
- `run-records` — brief/manifest/spec/tickets/traceability/acceptance; наружу: сами файлы (пишет только оркестратор).

Швы для тестов (единственные места проверки поведения): backend-сьют, frontend-сьют, ruff, mypy, production build, новые regression-тесты тикетов. Новых швов не вводить.

## Правила, которые исполнитель не выводит сам

- Стек: frontend Next.js (App Router); backend Python + FastAPI; БД PostgreSQL (+pgvector); MinIO/ClamAV/Redis/nginx. Точные версии фиксирует T02 — спроси их у отчёта T02, не выдумывай.
- Канонические команды гейтов — из брифа §5-Волна 0. Зависимости backend — только `uv sync --locked --extra dev` (голый `uv sync` запрещён); frontend — только `npm ci` по lock-файлу. Проверочные пайпы без `| tail`, `|| true` и аналогов.
- Тесты — только отдельная test schema/database; production для тестов запрещён.
- Не трогать: ветку `main`; immutable аудит-базeline (`docs/audit/2026-09-21-production`, findings, matrix, gate); чужие worktree и `.autopilot/*--wip` других прогонов; файлы прогона (`brief/manifest/spec/tickets/state.js/dashboard` — их пишет оркестратор).
- Исполнитель НЕ коммитит. Изменённые файлы + полный вывод тестов возвращаются оркестратору текстом.
- Недостающая зависимость или недоступный сервис — это `BLOCKED` с точной ошибкой и командой устранения, а не молчаливая установка и не заглушка.
- Секреты и ПДн: только имена (`BACKUP_OFFSITE_REMOTE`, `LLM_API_KEY`, …), никогда значения; в отчётах — ноль токенов, email, телефонов и содержимого проектов.
- Production: ноль исходящих соединений, ноль мутаций, ноль чтения `.env`/keys/credential stores.
- С 2026-09-24 исполнитель — отдельный Codex-контекст `gpt-6-luna`/`high` на таск; прежний OpenCode-контур завершён владельцем. Оркестратор сохраняет ревью, статусы и git.
- Целевые AI-пути: документы `AiDocConsultant` → `/rag/search` или `/chat/kaba`; реестры — контур `/chat/tuno`. Live provider тест остаётся BLOCKED до обновления владельцем ключа после локальных правок.
- Исполнитель тикетов обновлён владельцем 2026-09-25: реализацию ведёт `opencode/space-bunny-free` с reasoning variant `max`; Codex (сейчас `gpt-6-luna`) остаётся оркестратором и независимым приёмщиком. Эта запись актуализирует устаревшее упоминание Codex-исполнителя выше.

## Из T02 — проверенный backend test baseline (2026-09-24)

- `uv sync --locked --extra dev` → exit 0; lock-файлы не менялись.
- Ruff → exit 0; mypy → BLOCKED Python 3.14/numpy stub syntax.
- Исторический RED: pytest на локальном PostgreSQL `technozrelost_test` → exit 1 (705 passed, 15 failed, 1 warning); все 15 failures — тестовые mocks без `session_id` (`STAB-TEST-01`).
- После T22 (`14eca1d`): полный независимый pytest → exit 0, 720 passed, 1 warning; Ruff → exit 0. Backend CODE-03 разблокирован, mypy toolchain остаётся T04. Продуктовых интерфейсов T02/T22 не добавили.
- Подробные результаты и evidence: `evidence/T02-verification.md`.

## Из T03 — frontend baseline (2026-09-24)

- `npm ci` exit 0, 529 packages; `npm test` exit 0, 237 passed (независимый повтор оркестратора совпал).
- `npm run build` без env закономерно exit 1 (`API_URL_INTERNAL` production-guard). С CI-значением `API_URL_INTERNAL=http://backend:8000` exit 1: build-time fetch Manrope/JetBrains Mono из Google Fonts недоступен. Повтор оркестратора совпал. Это D02/T25; CODE-06 остаётся BLOCKED.
- Продуктовый код, package/lock и production не менялись. Подробности: `evidence/T03-verification.md`.

## Из T04 — mypy toolchain diagnosis (2026-09-24)

- Локальный Python 3.14 выбирает numpy 2.5.2 со стабом PEP 695, а mypy target в проекте 3.11. Канонический gate exit 2 до анализа приложения.
- Первую попытку isolated locked sync Python 3.11.15 остановила DNS-ошибка загрузки `httptools`; позднее доступ восстановлен (см. ниже).
- Диагностический target 3.12 проверил 62 файла, показал две ошибки приложения: Redis `from_url` в `realtime.py:109` (D03/T26) и validation handler в `main.py:311` (D04/T27). Оркестратор независимо воспроизвёл. Детали: `evidence/T04-verification.md`.
- Позднее совместимое Python 3.11 окружение восстановлено через разрешённый сетевой доступ в `/private/tmp/t04-backend-venv`: locked sync exit 0, канонический mypy проверил 62 файла и подтвердил ровно D03/D04. Toolchain blocker снят, сам mypy gate остаётся красным до T26/T27.

## Из T25 — локальные исходные шрифты (2026-09-24)

- Те же Manrope и JetBrains Mono размещены локально из официального `google/fonts`, бинарные SHA-256 независимо сверены; OFL включены, CSS-переменные не менялись. Код/тест: `6799a9a`.
- Frontend `npm test` → 238 passed; build через `--webpack` → exit 0 (53 страницы). Штатный Turbopack в sandbox падает на worker process `Operation not permitted`, не на fonts fetch; общий CODE-06/CI до отдельной проверки не объявлен GREEN.

## CI gate после T25 (2026-09-24)

- GitHub Actions run `35958291085`: backend stopped at mypy (D03/D04), frontend stopped at `npm audit` (D05-D07); frontend lint/tests/build в CI skipped. Локальный `npm audit --audit-level=high` exit 1: Next critical, sharp и browserslist high. Атомарные T28-T30 подготовлены; детали `evidence/CI-dependency-audit.md`.

## Из T26 — Redis typing (2026-09-24)

- `Redis.from_url` эквивалентен прежнему module-level factory в locked redis-py; нетипизированность ограничена локальной ссылкой, без новых публичных интерфейсов. `4236c95`.
- Независимый Python 3.11 mypy оставляет только T27, 10 SSE-тестов и Ruff PASS; см. `evidence/T26-verification.md`.

## Из T27 — полный backend gate (2026-09-24)

- Код `9f7791a`: handler типизирован по Starlette без смены HTTP 422 или fallback 500. Независимое review PASS.
- Python 3.11 в isolated env: полный mypy 62 файла без ошибок, Ruff PASS, pytest 720 passed / 2 dependency warnings на локальной test DB. См. `evidence/T27-verification.md`.

## Из T28 — patched Next и новый lint gate (2026-09-24)

- Next 16.3.3 в `f0f8b0a`, независимый audit 0 critical; sharp/browserslist high остаются T29/T30. npm ci и 238 tests PASS, webpack build 53 страницы PASS, default Turbopack локально EPERM; `evidence/T28-verification.md`.
- Полный lint выявил предсуществующий blocking `setState-in-effect` в org verification hint; D08/T31 отдельно. Не смешивать с security upgrade.

## Из T11 — атомарные AI-счётчики (2026-09-25)

- `ai_metrics.increment(metric: str, amount: int | float = 1) -> None` — единственная точка записи AI counters; increments и `snapshot() -> dict[str, Any]` используют одну process-local lock.
- Семантика остаётся in-memory и процессной; имена/типы метрик и rate policy не меняются. Не записывать в `METRICS` напрямую из app call sites.
- Доказательства: `.autopilot/2026-09-23-production-stabilization--wip/evidence/T11-ai-metrics-concurrency.md`.

## Из T12 — канонический DB index inventory (2026-09-25)

- Добавлены `technozrelost-backend/docs/database-indexes.md` и статический шов `technozrelost-backend/tests/test_db_index_inventory.py`; публичные API, ORM и схема БД не менялись.
- Тест извлекает именованные `CREATE INDEX` из шести явно покрытых SQL migration sources и сопоставляет их с документом; специально проверяет два частичных RAG ivfflat индекса.
- Проверки не доказывают совпадение key expressions/operator classes/`lists` каждого индекса с SQL: это неблокирующее замечание Craft review, оставлено concern для T21/final triage.
- Доказательства: `.autopilot/2026-09-23-production-stabilization--wip/evidence/T12-db-index-inventory.md`.

## Из T13 — static container hardening (2026-09-25)

- Оба Compose профиля задают зафиксированную security-политику по каждому сервису; custom backend/frontend runner images имеют непривилегированного пользователя. Проверка — статический `test_container_hardening.py` и `docker compose config --quiet`; контейнеры в T13 не запускаются.
- Различия runtime UID/entrypoint, writable mounts и ClamAV image behavior, требующие фактического запуска, остаются `UNKNOWN` до отдельной staging rehearsal. Не выводить non-root PASS для исключений без runtime evidence.
- `infra/container-hardening-runbook.md` — будущий change plan, не команда к применению: любое staging/production изменение требует отдельного письменного разрешения владельца; содержит preconditions, команды, impact/downtime, stop/health gates и rollback.
- T13 не меняет публичные API, бизнес-поведение, БД или schema. Evidence: `.autopilot/2026-09-23-production-stabilization--wip/evidence/T13-verification.md`.
