# Verification Report — Тикет 02 «Сквозное ядро УГТ без ложных функций» (release-audit)

- Тикет: `.scratch/release-audit/issues/02-core-flow.md` (Status: in-progress → ready-for-review)
- Blocked by: 01 — проверен, Status: ready-for-review ✅
- Worktree: `.worktrees/release-audit-complete` (ветка `codex/release-audit-complete`, HEAD a01a27b)
- Источники (READ-ONLY): `technozrelost-backend` release/friday-rc @9e6cccc; `technozrelost-frontend` codex/recovery-frontend @08511a1
- Дата: 10.08.2026. Все вердикты — по статическому чтению кода и `--collect-only` в чистом клоне; живые БД-прогоны BLOCKED (docker daemon DOWN).

---

## Outcome

Сквозное ядро УГТ (регистрация → вход → экспресс-оценка → проект → очередь менеджера → approve → УГТ → этапы N→N+1 → документы → автозаявка → approve/reject → отображение) **реализовано сквозно по коду BE+FE**: каждое звено цепочки имеет реальный endpoint + UI-обработчик, состояния честные (backend-ошибка остаётся ошибкой на всех проверенных экранах). Локального ложного успеха на пути ядра **не обнаружено**. Генерация документов (ТЗ/Паспорт/ТЭО) имеет сквозную механику, но **НЕ скрыта и не помечена «В разработке»** в UI — gap (см. Acceptance 3). Живой прогон happy path на test schema **BLOCKED**: docker daemon не запущен, PostgreSQL недоступен.

## Core flow trace (шаги 1–8, файл:строка)

| # | Шаг | Frontend | Backend | Таблицы / проверки |
|---|---|---|---|---|
| 1 | Регистрация | `FE/src/app/register/page.tsx:38-61` — POST `/api/v1/auth/register`; `!response.ok` → `setError(data.detail)` (:50-55), catch → «Сервис регистрации временно недоступен» (:58-61); успех → `router.push("/login")`. Роль по умолчанию `gk_customer` (:23), выбор из `PUBLIC_REGISTRATION_ROLES` (без `cntr_*`, :14) | `BE/app/api/v1/auth.py:40-69` — `register()`; запрет staff-ролей `CNTR_STAFF_SLUGS` (:42-46), 400 неизвестная роль (:50), 409 дубль email (:62-66); выдаёт access+refresh сразу (:69) | `users`, `user_roles`, `roles` (миграции 0001/0003/0010); пароль — `hash_password` |
| 2 | Вход | `FE/src/app/login/page.tsx:23-35` — `signIn("credentials", redirect:false)`; `response.error` → error (:28-32). `FE/src/auth.config.ts:43-57` authorize → POST `/api/v1/auth/login`; `!res.ok → null`; JWT-сессия, `accessToken` в сессии (:105-117), авто-refresh за 5 мин до истечения (:88-103) | `BE/app/api/v1/auth.py:72-80` — `login()`; 401 неверные креды (:76), 403 деактивирован (:78); ротация refresh (:83-114) | `users`, `refresh_tokens` (0001, 0015); хеш refresh-токена |
| 3 | Экспресс-оценка УГТ | `FE/src/components/questionnaire/questionnaire-wizard-client.tsx:239` — GET `/assessments/template`; `:308-334` — POST `/assessments`; `!response.ok` → throw с detail → `setSaveError` (:329-336); успех → переход по `id` из ответа сервера (:333-334) | `BE/app/api/v1/assessments.py` — `create_draft()`: черновик проекта с `preliminary_level`, `completion_pct`, `dimension_scores`; audit при сохранении; `_ensure_template` создаёт шаблон 22 рубежей при отсутствии (:95+) | `assessment_templates`, `assessment_checkpoints`, `assessment_answers`, `project_assessments`, `questionnaire_results` (0004, 0010, 0011) |
| 4 | Создание проекта | карточка черновика → publish; визард доступен всем ролям (маршрут `/dashboard/gk_customer/projects/new`) | `BE/app/api/v1/projects.py:72` `create_project` (POST `/projects`, audit :125); `:264` `publish_project` (PUT `/projects/{id}/publish`); ownership — `require_project_access` (:175-179), `can_access_project` (владелец/участник/CNTR-staff) | `projects`, `project_members`, `project_assessments`; OWN-проверки |
| 5 | Очередь менеджера | `FE/src/app/dashboard/cntr_manager/page.tsx:32-47` load — `Promise.all` 3 запросов, любой `!ok` → throw → `setError` (:42-45); `:52-59` `decideDraft` POST `.../decide` — `!res.ok` → throw(detail), успех → `await load()` (перезагрузка с сервера); `:60-69` `decidePromotion` — аналогично; busy-state на кнопках | `BE/app/api/v1/manager.py:39` ROLE `cntr_manager\|cntr_admin`; `:94-107` GET `/manager/queue/drafts` (status=draft); `:110-174` `decide_draft` — approve: `status="published"`, `current_level=level` (не ниже 2, не выше preliminary, :120-130), создание контрольных точек (:134-143), audit `project.published` (:144-150), уведомление владельцу (:165-172); reject: `status="rejected"` + причина + audit (:152-162) | `projects`, `control_points`, `audit_trail`, `notifications`; проверки уровня N≥2 и ≤preliminary |
| 6 | Присвоение УГТ, отображение | карточка `/dashboard/project/[id]` — УГТ-бейджи, статусы, радар; реестр `GET /projects/registry` (фильтр ugt_min/ugt_max) | `manager.py:131-133` — `current_level` фиксируется при approve; публикация в реестре; `projects.py` `get_project_detail` + `registry` | `projects.current_level`, `status` |
| 7 | Этапы N→N+1, документы, автозаявка, approve/reject | `FE/src/components/stage-progress-panel.tsx` — GET `/stage-requirements` (:32-34), POST `/stage-document-file` (multipart, :54-59), POST `/stage-evaluate` (:62-68, :77-80); статусы «Загружено/Не загружено», результат предварительной оценки, «Заявка автоматически отправлена менеджеру ЦНТР» (:97); ошибки — `errorText(detail)` + `setError`; подключён в карточке: `project/[id]/page.tsx:540` | `BE/app/api/v1/stages.py` — `stage_requirements` (:150-163, 409 если не published / УГТ 9); `upload_stage_document_file` (:343-413, scan антивирус, только clean засчитывается, :403-412); `_trigger_application` (:178-340) — полный комплект → создание/обновление `PromotionRequest` (attempt_no, снимок версий `PromotionRequestDocument`), предварительная LLM-оценка (`_evaluate` :99-139, `success`/`None` при недоступности LLM), статусы `docs_uploaded`/`evaluation_unavailable`/`pending_manager`, защита от повторной заявки неизменённым комплектом (409, :259-264), audit `promotion.requested` (:321), уведомление менеджерам (:313-318); `manager.py:237-311` `decide_promotion` — строго N→N+1 от текущего уровня (409 :250-259), approve → `current_level=to_level` + audit `promotion.approved` (:261-273), reject → причина + `missing` + audit (:274-293), уведомление владельцу (:295-308) | `stage_requirements`, `project_documents` (doc_type=stage), `promotion_requests`, `promotion_request_documents` (0013, 0019, 0020), `audit_trail`; OWN `require_project_access` (stages.py:154, 358, 424) |
| 8 | Обработка ошибок FE (ложный успех) | Проверены все обработчики пути: register (page.tsx:50-61), login (login/page.tsx:28-32), визард (questionnaire-wizard-client.tsx:329-336), очередь менеджера (cntr_manager/page.tsx:42-45, 57-58, 67-68), карточка (project/[id]/page.tsx:209-219, 240-246, 260-271, 377-390, 408-415, 446-455), этапы (stage-progress-panel.tsx:33-38, 58-69, 78-81). Паттерн везде: `!res.ok` → throw (с detail) → `setError`; успех → перезагрузка списка с сервера (`await load()`), переход по id из ответа сервера | — | **Ложного успеха нет**: нигде нет добавления в список до ответа сервера, игнорирования ошибок или fallback-данных на пути ядра. Единственная известная заглушка — лендинг `/projects` (`FE/src/lib/showcase.ts:1-25`, R1 тикета 01, вне ядра УГТ) |

## Checks (клон backend в /tmp)

- Клон: `/tmp/tz-release-audit/be-clone` — создан заново (10.08.2026), `git checkout release/friday-rc` → HEAD `9e6cccc66c6eef84728c87aa65a1ea67389fcdb5` (совпадает с каноническим @9e6cccc).
- `uv sync --all-extras` — **успешно** (venv `.venv`, python 3.14; пакеты fastapi/sqlalchemy/alembic/uvicorn и др. установлены).
- `PYTHONDONTWRITEBYTECODE=1 uv run pytest --collect-only -q` — **191 тест собран за 7.39s** (список тестов без запуска). Замечание: первый запуск подхватил чужой `VIRTUAL_ENV` (venv Hermes, сломанный pydantic_core) — повторный запуск с `env -u VIRTUAL_ENV` отработал корректно в `.venv` клона.
- `docker info` — **daemon DOWN** → реальный `uv run pytest` (нужен PostgreSQL: conftest.py создаёт/мигрирует `technozrelost_test` через alembic head, tests/conftest.py:28-55) и `uv run alembic upgrade head` — **BLOCKED**, результат не подменялся.
- Команда владельцу для живого прогона:
  ```
  docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica && uv run alembic upgrade head && uv run pytest
  ```

## Document generation verdict (Шаг 3)

- **Есть (сквозная механика):** endpoint `POST /api/v1/projects/{id}/generate/{doc_type}` (`BE/app/api/v1/generation.py:13-31`, валидация tz/passport/teo, 400/404); сервис `BE/app/services/document_generator.py:83-140` — шаблон из `rag_documents`, подстановка переменных (при незаполненных данных — нейтральные «0%»/«—», :71-78), сохранение `ProjectDocument` (status=draft, контент в `file_url`), запись audit; UI-кнопки «ТЗ/Паспорт/ТЭО» (`FE/src/app/dashboard/project/[id]/page.tsx:163-167` DOC_TYPES, рендер :685-698, обработчик `generateDocument` :367-396, доступен всем участникам); тест `test_document_generation`.
- **Вердикт: НЕ считается готовой (по спеке release-audit: «Генерация документов скрывается/отключается и не считается готовой»). В коде НЕ скрыта и НЕ помечена «В разработке»** → gap:
  - **GAP-DOC-1, severity medium:** кнопки генерации ТЗ/Паспорт/ТЭО активны и видны всем участникам карточки проекта — `FE/src/app/dashboard/project/[id]/page.tsx:685-698` (объявление типов :163-167). Рекомендация: скрыть секцию генерации или пометить «В разработке» (правка за оркестратором, в рамках тикетов 03/04 baseline). Backend-endpoint покрыт тестом — можно оставить, но не афишировать в UI.

## Acceptance criteria (4 пункта)

1. **Happy path на чистой test schema без mock data — PASS (по коду) / BLOCKED (живой прогон).** Все звенья цепочки реализованы сквозно (таблица Core flow trace выше); conftest мигрирует изолированную `technozrelost_test` через alembic head без seed-моков (tests/conftest.py:11-13, 28-55; `LLM_API_KEY=""` — тесты не зависят от внешнего LLM). Живой прогон невозможен: docker daemon DOWN (проверено `docker info`). Команда: `docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica && uv run alembic upgrade head && uv run pytest`.
2. **Ошибки API отображаются как ошибки, нет локального ложного успеха — PASS.** Доказательства: register `FE/src/app/register/page.tsx:50-61`; login `login/page.tsx:28-32`; визард `questionnaire-wizard-client.tsx:329-336`; очередь менеджера `cntr_manager/page.tsx:42-45,57-58,67-68` (успех → `await load()` с сервера, не локальное добавление); этапы `stage-progress-panel.tsx:33-38,58-69`; карточка `project/[id]/page.tsx:209-219,377-390`. Нигде на пути ядра нет добавления в список до ответа сервера, игнорирования ошибок или fallback-данных.
3. **Неготовая генерация документов скрыта/отключена — FAIL.** Кнопки ТЗ/Паспорт/ТЭО активны и доступны всем участникам: `FE/src/app/dashboard/project/[id]/page.tsx:685-698` (типы :163-167). По спеке функция не считается готовой → требуется hide/«В разработке» (GAP-DOC-1, severity medium; правка за оркестратором, код не менялся).
4. **Контрактные и браузерные тесты покрывают путь — PARTIAL (BE контрактные — есть; FE/E2E — нет).** BE: 191 тест (34 файла, `--collect-only` в клоне). Покрытие пути: `test_auth_smoke`, `test_auth_refresh` (шаги 1-2); `test_readiness_assessment`, `test_project_create`, `test_new_core`, `test_demo_journey` (шаги 3-4); `test_official_ugt`, `test_manager_verification`, `test_full_ugt_journey` (`test_full_ugt_journey_1_to_9`, шаги 5-7); `test_requirement_sets`, `test_file_storage`, `test_comments_pdf_retention` (документы); `test_rbac_projects`, `test_publication_privacy`, `test_join_mechanic`, `test_invites` (RBAC/ownership); `test_document_generation` (генерация). FE: 4 unit-теста (`tests/ui-shell.test.mjs`, `theme-logic.test.mjs`, `api-client.test.mjs`, `api-client-behavior.test.mjs`); компонентных тестов пути (register/wizard/stage-progress/cntr_manager) нет. Браузерный E2E отсутствует и BLOCKED без сервера/БД (команда владельцу — как в Acceptance 1, плюс запуск FE `npm run dev`).

## Verification commands (воспроизведение)

```bash
# Клон и сбор тестов (выполнено)
git clone "$REPO" /tmp/tz-release-audit/be-clone
cd /tmp/tz-release-audit/be-clone && git checkout release/friday-rc && git rev-parse HEAD   # 9e6cccc…
cd technozrelost-backend && uv sync --all-extras
env -u VIRTUAL_ENV PYTHONDONTWRITEBYTECODE=1 uv run pytest --collect-only -q | tail -5      # 191 tests collected in 7.39s

# Docker / БД (BLOCKED — daemon DOWN)
docker info                                    # error during connect → DOWN
docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica && uv run alembic upgrade head && uv run pytest   # команда владельцу
```

## Security observations

- Секреты/`.env`/connection strings не читались и не выводились (проверки — только по коду).
- На пути ядра auth/RBAC/ownership соблюдены: `require_role("cntr_manager","cntr_admin")` (manager.py:39), `require_project_access` на проектах/этапах/файлах (projects.py:175-179, stages.py:154/358/424), запрет staff-ролей в публичной регистрации (auth.py:42-46).
- Перенесённые из тикета 01 наблюдения (вне правок тикета 02): R3 access_token в query string SSE (notification-bell.tsx:65, realtime.py:46, medium); R5 нет audit для auth-событий/скачиваний (medium); R1 лендинг-витрина на хардкоде showcase.ts (high, вне ядра УГТ).
- Внешний LLM получает только `rag_documents` (ГОСТы/шаблоны), пользовательские документы в контекст не передаются; при недоступности LLM оценка этапа честно возвращает `evaluation_unavailable`, а не ложный SUCCESS (stages.py:124-127).

## Open risks

- Живой прогон happy path и E2E невозможны до поднятия PostgreSQL (docker DOWN) — вердикты по коду, не по исполнению.
- GAP-DOC-1 (кнопки генерации не скрыты) — единственный FAIL тикета; правка за оркестратором (тикеты 03/04).
- Замечание окружения: первый `uv run pytest` в клоне подхватил экспортированный `VIRTUAL_ENV` (venv Hermes) — при воспроизведении использовать `env -u VIRTUAL_ENV` или чистую оболочку.

## Git status

- Финальные команды выполнены: `git rev-parse --show-toplevel` (корень репозитория), `git branch --show-current` (`codex/release-audit-complete`), `git status --short`, `git diff --name-status`, `git diff --check` — см. ниже; изменены только файлы `$WT/.scratch/release-audit/issues/02-core-flow.md`, `$WT/.scratch/release-audit/verification-report.md`, `$WT/Status.md` (артефакты тикета в своём worktree).

## Подтверждения

- (а) Чужие worktree (FE/BE) не изменялись: все исполняемые прогоны — только в чистом клоне `/tmp/tz-release-audit/be-clone`; в FE/BE — только чтение кода.
- (б) `git add`/`commit`/`push`/`merge`/`rebase`/`reset` не выполнялись.
- (в) Следующий тикет (03/04) не начинался.
