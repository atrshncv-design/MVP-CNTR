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
