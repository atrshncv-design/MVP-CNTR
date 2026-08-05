# Baseline audit — Friday Release Candidate (тикет 01)

Дата: 05.08.2026. Исполнитель: автономный инженер. Метод: инвентаризация + фактические прогоны + live-smoke, без изменения бизнес-логики.

## 1. Зафиксированное состояние

### Worktrees / ветки / коммиты
| Worktree | Ветка | HEAD | Статус |
|---|---|---|---|
| technozrelost-backend | codex/recovery-backend | 779c6ac | чистый |
| technozrelost-frontend | codex/recovery-frontend | 8d51882 | чистый (+ пользовательский `.hermes/` — не тронут) |
| friday-release-candidate | codex/friday-release-candidate | ef914f9 | чистый |
| main (корень) | main | c2964a2 | пользовательские незакоммиченные изменения — не тронуты |

### Сервисы (live)
- PostgreSQL primary :5432 (tz-pg-primary) и replica :5433 (tz-pg-replica) — healthy (Docker).
- Backend uvicorn :8000 — `GET /api/v1/health` → `{"status":"ok"}`, `GET /api/v1/ready` → 200.
- Frontend dev :3000 — не запущен (запускается по требованию).

### Backend: маршруты (17 роутеров, префикс /api/v1)
health, ready; auth (register/login/refresh); projects (CRUD, registry, stage-requirements, stage-documents, stage-evaluate); membership (join, join-requests, decide, regenerate-token, priority); assessments (template, POST — создание черновика с preliminary_level, mine); manager (queue/drafts, queue/promotions, decide, history); notifications (list, read); stages; generation (документы); executors; technologies; chat (AI-ассистент); rag; users (профиль/админ); nioktr (реестр + организации).

### Backend: миграции и схема
- Alembic: 0015 = head на dev и test. `db_migration_log`: dev — 16 записей, test — 13 (разница — ручные SQL-применения на dev, не блокер).
- Таблицы (23): roles, permissions, users, user_roles, refresh_tokens, projects, questionnaire_results, assessment_templates, assessment_checkpoints, project_assessments, assessment_answers, project_members, control_points, project_documents, audit_trail, rag_documents, organizations, stage_requirements, promotion_requests, verification_documents, notifications, technologies, nioktr_cards.
- Сервисы: ai_assistant, document_generator, rag, readiness_assessment; сиды: seed_admin, seed_gost, seed_nioktr, seed_templates.

### Frontend: маршруты (33)
- Публичная зона `(landing)`: /, /about, /methodology, /levels, /levels/[id], /customers, /performers, /roadmap.
- Auth: /login, /register, /api/auth/[...nextauth].
- ЛК: /dashboard (9 ролей: gk_customer, rd_executor, scientific_org, serial_manufacturer, investor, auditor, cntr_admin, cntr_manager, regulating_organization), projects, project/[id], technologies, executors, nioktr (+ карточка по reg-номеру), organizations (+ по ОГРН), ai-assistant, заявка нового проекта.
- Прочее: /join/[token], /forbidden.
- Компоненты: assess-ugt-card, join-project-form, questionnaire, stage-progress-panel, verification-docs-panel, theme-toggle, ugt-scale, landing. Lib: api-client, roles, ugt-data.

### Infra
- `infra/docker-compose.yml` (local): pg-primary, pg-replica. `infra/docker-compose.prod.yml`: backend, db, frontend, nginx.
- `infra/deploy.sh` + `infra/README-DEPLOY.md`, `infra/.env.production.example`, корневой `.env.example`.
- **MinIO, Redis, ClamAV отсутствуют и в compose, и в коде** (grep по app/ — 0 совпадений).

## 2. Результаты baseline-гейтов

| Gate | Команда | Результат |
|---|---|---|
| Backend lint | `uv run ruff check app/ tests/` | ✅ All checks passed |
| Backend tests | `uv run pytest -q` | ✅ **97 passed** (1 StarletteDeprecationWarning, 89.6s) |
| Frontend lint | `npm run lint` | ✅ clean |
| Frontend types | `npx tsc --noEmit` | ✅ clean (exit 0) |
| Frontend build | `npm run build` | ✅ 33 маршрута, без ошибок |
| Frontend tests | `npm test` | ⚠️ **4/5** — падает №5 (см. B2) |
| Compose syntax | `docker compose -f infra/docker-compose.yml config --quiet` | ✅ OK |
| Live health | `curl /api/v1/health`, `/api/v1/ready` | ✅ 200/200 |
| Live register | `POST /api/v1/auth/register` (probe.audit@example.com) | ✅ 200, пара токенов |
| Live protected | `GET /api/v1/projects` без токена | ✅ 401 (корректно) |
| Миграции | alembic current (dev+test) | ✅ 0015 head |

## 3. Матрица расхождений со спецификацией

### Verified (работает, соответствует спецe)
- V1 Публичная витрина: 8 страниц лендинга (US 1–5), auth-aware навигация.
- V2 Регистрация с ролью; роли ЦНТР закрыты серверным guard (403 при прямом POST cntr_*).
- V3 Refresh-цикл: access 60 мин + вращаемый refresh 14 дней (backend 779c6ac, frontend 8d51882).
- V4 Экспресс-оценка: 22 рубежа, расчёт server-side (`compute_readiness`, `compute_current_level`), preliminary_level 1–9, черновик.
- V5 Очереди менеджера: drafts + promotions, approve/reject с причиной, история попыток.
- V6 Автозаявка N→N+1: stage-documents → promotion_requests, триггер по последнему документу.
- V7 Реестры API: registry (только published), НИОКТР 16 582 карточки + каталог организаций.
- V8 Join-механика: токен TZ-*, join-requests, priority-члены, regenerate.
- V9 audit_trail, notifications (REST-чтение), verification_documents, control_points.
- V10 Демо-путь MVP1 (тест demo_journey) жив.

### Missing (спека требует — не реализовано, закрывается тикетами)
- M1 (03): профили пользователя draft/pending/verified/rejected; членство в нескольких организациях (organizations есть, user↔org membership нет); проверка профиля менеджером; реестры специалистов/организаций из verified-профилей.
- M2 (04): одноразовые приглашения (срок, допустимые роли); массовые приглашения (лимит, отзыв); передача project_admin; договорное владение/правообладание/основание договора.
- M3 (05): механизм «официальный УГТ ≤ 2 автоматически» (сейчас подтверждение черновика сразу даёт заявленный уровень); разделение preliminary/confirmed в UI.
- M4 (06): MinIO-хранилище с закрытыми бакетами, проверка MIME, ClamAV-карантин, версии файлов, hash в PG. (project_documents есть, файлового сервиса нет.)
- M5 (07): фиксированный версионированный справочник комплектов; триггер «последний чистый документ» (частично есть в stage-documents → promotion); снимок версий в заявке.
- M6 (08): структурированный отказ (критерии + документы + причина + рекомендации) — частично (причина есть); правило «после первичного подтверждения только N→N+1» — проверить/доделать.
- M7 (09): комментарии к заявке; PDF-заключение без УКЭП; политика хранения (скрытие неверифицированных версий, 30 дней, физическое удаление).
- M8 (10): публичный доступ к registry/карточкам (см. B1); согласие владельца на публикацию; опциональный предварительный УГТ на карточке; фильтры по подтверждённому УГТ; приватность проекта/участника + demo-тарифный экран.
- M9 (11): реестры только verified; НИОКТР read-only с источником/датой импорта (поля проверить); раздельные поля/фильтры специалистов и организаций.
- M10 (12): SSE/realtime; звук; атомарное взятие общей задачи; переназначение администратором; outbox под Bitrix.
- M11 (13): архив; проектная лента; глобальный append-only аудит; экспорт-пакет.
- M12 (15/16): удмуртская тема (3 направления → выбор), система трёх тем (сейчас 2: светлая/тёмная).
- M13 (17): mobile-ready, WCAG AA, browser matrix.
- M14 (18): полный Docker-контур (nginx+next+fastapi+pg primary/replica+redis+minio+clamav), реплики app-слоя, health/readiness, volumes.
- M15 (19): demo seed/reset одной командой (9 проектов УГТ 1–9 + последовательный проект), блокировка в production.
- M16 (20): backup/restore PG+MinIO, метрики, Grafana, structured logs.
- M17 (21): нагрузочный профиль 1000 пользователей (70/20/8/2), security harness.
- M18 (22): финальный black-box gate + runbook.

### Broken (реализовано не по спеке)
- B1 (10/11): `GET /api/v1/projects/registry` и `GET /api/v1/nioktr` требуют авторизацию → 401 для посетителей; спека (US 6–14) — публичный просмотр реестров без входа.
- B2 (тест): `tests/ui-shell.test.mjs` №5 падает — `doesNotMatch(/const statCards/)` в `gk_customer/page.tsx`; фактическая страница честная (значения из API, нули при недоступности API), устарел ассерт на имя переменной. Минимальный фикс — в тикете 02.

### Obsolete / историческое
- O1 PROGRESS.md содержит только старую таблицу MVP1 (01–19) — дополняется таблицей Friday RC (этот тикет).
- O2 DESIGN.md (v1) устарел: источник истины по дизайну — `src/app/globals.css` (дизайн-система 3.0, двойная тема).
- O3 Папка «КОД MVP "0"» и docx-архивы в docs-worktree — исторический референс (ссылка из docs/prompts), НЕ удалять.
- O4 `.graphify/` — генерируемые артефакты, не коммитить (правило AGENTS.md).

## 4. Незатронутое
- Пользовательские незакоммиченные изменения: main (корень) и frontend `.hermes/` — не изменялись и не коммитились.
- Бизнес-логика, модели, API, миграции — не менялись.

## 5. Вывод
Baseline воспроизводим: backend 97/97 + ruff чист, frontend lint/tsc/build зелёные (тесты 4/5, один stale-ассерт), compose валиден, миграции на head 0015, ключевые API живые. Расхождения классифицированы (V10/M18/B2/O4). Известные пробелы соответствуют тикетам 03–22; самый заметный продуктовый — публичные реестры закрыты auth (B1) и отсутствие файлового контура MinIO/ClamAV (M4).
