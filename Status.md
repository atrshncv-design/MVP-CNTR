# STATUS / CURRENT STATE

## Planning update — 10.08.2026

- ✅ Autopilot-интервью завершено: согласованы границы release candidate, ready/beta/in-development/out-of-scope, двенадцать release-сценариев и ручные launch gates.
- ✅ Создан изолированный worktree `codex/week-release-planning`; текущие пользовательские изменения основного дерева не затронуты.
- ✅ Опубликована мастер-спека `.scratch/week-release-rc/spec.md`.
- ✅ Опубликованы 8 пакетных спецификаций и 40 атомарных тикетов: repo hygiene, release audit, identity/organizations, requests/matching, operations, internal frontend, AI/RAG, security/infrastructure.
- ✅ Codex Security установлен как дополнительный слой аудита; автоматические SAST/SCA/DAST/Kali остаются основными release gates.
- ✅ Добавлен reusable мастер-промпт модели-разработчика и workflow передачи одного frontier ticket без GitHub-доступа.
- ⚠️ Реализация не начата: по решению Functional Validator код пишет более дешёвая модель, оркестратор проверяет и публикует только принятые изменения.
- ⚠️ Внешний запуск блокируют сервер, юридические тексты, SMTP, второй владелец эксплуатации и успешный staging security gate.

## Release-audit — 10.08.2026
- 🚀 Запущена спека `.scratch/release-audit/spec.md` (тикеты 01–04) в worktree `.worktrees/release-audit-complete`, ветка `codex/release-audit-complete`, база `a01a27b`.
- ✅ Тикет 01 (contract map) выполнен: evidence-matrix.md создан (`.scratch/release-audit/evidence-matrix.md`), переведён в ready-for-review (не done). Итог: 88 endpoints (5 public, 9 optional, 74 auth, 18 role-restricted), 32 таблицы/23 миграции, 34 тест-файла, 37 экранов FE; 17 PASS / 5 PARTIAL; топ-разрывы: R1 лендинг-витрина на хардкоде showcase.ts (high), R3 access_token в query SSE (medium), R5 нет audit auth-событий (medium), R7 спец-функции auditor/scientific_org не реализованы (medium); генерация документов — не считается готовой (hide/«В разработке»); AI/RAG — PASS (только rag_documents, read-only).
- ✅ Тикет 02 (core flow УГТ) выполнен: verification-report.md создан (`.scratch/release-audit/verification-report.md`), переведён в ready-for-review (не done). Сквозной путь регистрация → вход → экспресс-оценка → проект → очередь менеджера → approve → УГТ → этапы N→N+1 → документы → автозаявка → approve/reject → отображение подтверждён по коду (BE+FE), ложного успеха на пути ядра не найдено; клон /tmp: 191 тест собран (collect-only); pytest/alembic — BLOCKED (docker DOWN, команда владельцу в отчёте). Acceptance: 2×PASS, 1×FAIL (генерация документов не скрыта, GAP-DOC-1 medium, project/[id]/page.tsx:685-698 — правка за оркестратором), 1×PARTIAL (BE-тесты есть, FE 4 unit, E2E нет/BLOCKED).
- ✅ Тикет 03 (матрица ролей и IDOR) выполнен: role-access-matrix.md создан (`.scratch/release-audit/role-access-matrix.md`), переведён в ready-for-review (не done). Матрица 9 ролей × разделы по коду BE (роли из 0003_rbac.sql; self-assign служебной роли закрыт — auth.py:42-46 + тест); IDOR-аудит 33 endpoint с object-id: 31 ЗАКРЫТ / 0 ОТКРЫТ / 2 частично (SSE access_token в query — R3 тикета 01; генерация документов не готова); permissions-таблица в рантайме не проверяется (require_permission отсутствует) — G1 medium; негативные тесты перечислены (test_rbac_projects, test_publication_privacy, test_file_storage, test_comments_pdf_retention, test_new_core, test_invites, test_join_mechanic, test_auth_smoke, test_profile_admin, test_control_points и др.), пробелы G3 (нет тестов: notifications mark_read чужим, rescan чужого файла, INV-token невалидный, /rag/templates 403, chat 429); клон: collect-only 191 тест; живой прогон негативных тестов — BLOCKED (docker DOWN). Acceptance: 2×PASS (проектный доступ, self-assign), 1×PARTIAL (покрытие отказов тестами + audit), 1×BLOCKED (живой прогон).
- 🔒 Зафиксированный scope: только аудит и доказательство сквозной работоспособности; новые крупные модули не добавляются; исправления — только найденные разрывы в рамках спеки; чужие worktree не изменяются (проверки — read-only/чистые клоны); docker/БД недоступны → БД-зависимые проверки будут BLOCKED с командами воспроизведения.
- 📄 Документов SECURITY.md / THREAT_MODEL.md / CONTEXT.md / docs/adr в репозитории нет (зафиксировано; доменные доки — по docs/agents/domain.md, читаются молча).

## Release-audit — итог спеки (10.08.2026)
- 🏷️ **Итоговый статус спеки: `ready-for-review with open FAIL/PARTIAL/BLOCKED findings`** — см. статусы acceptance criteria в тикетах 02/03/04 (FAIL: генерация документов не скрыта, ruff 4×E501; PARTIAL: E2E-покрытие, пробелы негативных тестов, структурный smoke; BLOCKED: все БД-зависимые прогоны — docker DOWN).
- ✅ Тикеты 01–04 выполнены последовательно (01→02→03→04), все — `Status: ready-for-review` (НЕ done). Артефакты в `.scratch/release-audit/`: `evidence-matrix.md`, `verification-report.md`, `role-access-matrix.md`, `baseline-report.md`.
- 📊 **Evidence matrix (тикет 01):** 88 endpoints (74 auth, 18 role-restricted), 9 ролей, 32 таблицы/23 миграции, audit_trail + 11 точек, 34 тест-файла, 37 экранов; 23 сценария: 17 PASS / 5 PARTIAL / 0 FAIL / 0 NOT IMPLEMENTED; разрывы R1–R10; AI/RAG — PASS (только rag_documents, rate-limit); генерация документов — PARTIAL (hide).
- 🔄 **Core flow (тикет 02):** ядро УГТ (регистрация→оценка→проект→менеджер→этапы N→N+1→автозаявка→approve/reject) подтверждено по коду, ложного успеха нет; 191 тест собрано в клоне; GAP-DOC-1 (кнопки генерации документов не скрыты) — FAIL критерия, правка за оркестратором.
- 🔐 **Роли/IDOR (тикет 03):** 33 endpoint с object-id → 31 закрыт / 0 открыт / 2 частично (SSE-токен, генерация); служебная роль самостоятельно не назначается (403, тест есть); разрывы G1–G9; негативные тесты 401/403/404/409 покрыты, 5 пробелов (G3).
- 🟢 **Baseline (тикет 04):** frontend-клон @08511a1 — lint/tsc/build(29 маршрутов)/test(14/14) все PASS; backend ruff — FAIL 4×E501 (известный backlog repo-hygiene, НЕ правился); pytest/alembic/health — **BLOCKED** (docker DOWN); структурный smoke 9 ролей — 7 PASS / 2 PARTIAL (auditor/scientific_org спец-функции R7); secret scan FE/BE — 0 сильных; mock-success R1 `src/lib/showcase.ts` подтверждён (untracked в FE worktree).
- ⛔ **BLOCKED (команды владельцу):** БД-зависимые проверки — `docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica && uv run alembic upgrade head && uv run pytest`; живой браузерный smoke/E2E — поднять compose + `uv run uvicorn app.main:app --port 8000` + `npm run dev`.
- 📋 **Gap-остатки «требуют решения оркестратора» (11):** R1 (showcase-заглушка, high), R3/G2 (SSE access_token в query, medium), R4, R5 (нет audit auth), R8, R10, G3 (5 негативных тестов), G6, G8, G9/GAP-DOC-1 (кнопки генерации не скрыты). Утверждённые остатки (5): R2, R6, R7/G7, R9, G1, G5.
- 🔧 Продуктовый код FE/BE не изменялся; `git diff --check` — чисто; `git add/commit/push` не выполнялись.

## Тикет 01 (repo-hygiene/inventory) — 10.08.2026
- ✅ Read-only инвентаризация репозитория и секретов завершена (повторная попытка v2): канонические frontend/backend определены, все крупные пути классифицированы, рабочее дерево и история (205 коммитов) проверены на секреты — сильных секретов не обнаружено.
- ✅ Полный отчёт: `.scratch/repo-hygiene/inventory-report.md`; тикет переведён в `Status: ready-for-review` (commit/push — за оркестратором).
- 🔧 Правка по ревью (10.08.2026): в таблицу Removal candidates добавлены честные поля `Owner` / `Decision owner` / `Deletion approval required` («Owner: не установлен» там, где владелец не зафиксирован), формулировка критерия 3 уточнена.
- ✅ Тикет 01 принят оркестратором (10.08.2026): read-only inventory проверен, отчёт и разрешённый diff готовы к commit/push.

**MVP1 «Технозрелость» — готов к сдаче 31.08.2026** (пайплайн: спека → тикеты → реализация → QA)

## Актуальная фаза (03.08.2026)
- ✅ Интервью-продолжение (19 решений) завершено — лог: `.scratch/mvp1-release/interview-log.md`
- ✅ **Спека обновлена** (`.scratch/mvp1-release/spec.md`, 03.08): новое ядро продукта — экспресс-оценка УГТ любым пользователем → проект-черновик → апрув менеджера (присвоение официального УГТ) → два реестра (общий + технологии УГТ 7+) → автозаявка на повышение N→N+1 по полноте комплекта документов → предварительная оценка по ГОСТам → верификация менеджером. Роль «Эксперт УГТ» → **«Регулирующая организация»** (join по токену → документы подтверждения). Демо-маршрут №18, критерии приёмки №19 (чек-лист 6 шагов).
- ✅ **Тикеты 20–31 опубликованы** (`.scratch/mvp1-release/issues/`): 20 схема БД → 21–25 API (экспресс-оценка, очереди менеджера, этапы/автозаявка, реестры, верифицирующие документы) → 26–30 фронтенд → 31 сквозные тесты + демо №18 + QA
- ✅ **Дизайн-система v1** (`DESIGN.md` + роллаут токенов в Tailwind v4): палитра OKLch на гамме бренда, типографика PT Serif (display) / Inter (body) / JetBrains Mono (ID/УГТ/цифры), компонентный слой `tz-*`, правила (один акцент ≤2×, без эмодзи, честные empty-state). Проверено: lint + tsc + production build (23 маршрута) зелёные
- ✅ **Тикеты 26–30 — дизайн-слой фронтенда**: «Оценить УГТ» во всех 9 ЛК (+ счётчик черновиков, маршрут опросника открыт любой роли); ЛК менеджера — две очереди («Новые проекты» / «Заявки на повышение», счётчики, честные empty-state до API); реестр — переключатель «Проекты / Технологии УГТ 7+» + фильтры в новой системе; карточка проекта — шапка с УГТ-бейджами и статусом; роль переименована в «Регулирующая организация» (display-слой)
- ✅ **Тикеты 20–25 реализованы и запушены**: миграция 0010, словарь 8 этапов N→N+1, экспресс-оценка, очереди менеджера, автозаявка с LLM-предоценкой по ГОСТам, общий реестр, верифицирующие документы и роль `regulating_organization`. Backend: `de9923e`, 79/79 pytest, ruff clean.
- ✅ **Фронтенд-привязка к API нового ядра запушена** (`9586d79`, codex/recovery-frontend): визард → `POST /assessments`, черновики через `/assessments/mine`; ЛК менеджера → `/manager/queue/drafts` + `/manager/queue/promotions` (approve/reject, причины, счётчики, empty states); реестр → `/projects/registry` (+ фильтры ugt_min/ugt_max/category/budget); карточка проекта → stage-progress-panel (требования N→N+1, загрузка, предварительная оценка, автозаявка); verification-docs-panel для регулирующей организации; фикс Auth.js `trustHost` (был сломан весь вход — UntrustedHost)
- ✅ **API-QA нового ядра пройден на живых данных** (03.08): экспресс-оценка → черновик (проекты 9, 10); approve черновика менеджером → published + УГТ 3; требования этапа 3→4 → загрузка документа → **автозаявка автоматически** (`pending_manager`, оценка `evaluation_success: true`, уведомление менеджеру) → approve → УГТ 4; заявка 4→5 → reject с причиной (уровень не изменился, история попыток `attempt_no`); регулирующая организация: регистрация → join по токену TZ-… → approve менеджером → verification-doc загружен → виден менеджеру в заявке; реестр: только published + фильтры работают; запрет переоценки существующего проекта (409)
- ✅ **Визуальный QA в браузере (03.08, завершён)**: вход менеджером → очереди (9 черновиков + заявка) → апрув заявки №3 через UI («Подтвердить» → счётчик 1→0, empty-state, проект 13: УГТ 1→2, published) → ЛК регулирующей организации (список загруженных документов из карточки) → секция «Верифицирующие документы» в карточке проекта. Ложная тревога «кнопка не работает» = клик уходил мимо кнопки ниже области видимости (не баг продукта)
- ✅ **Дефект verification-docs закрыт**: `verification_documents` в карточке проекта (`GET /projects/{id}`), пустой список по умолчанию; владелец/участники видят документ (проверено на проекте 13: vdoc id=2 «Подтверждение УГТ 1785755323»). Backend: `8e13f84`, 80/80 тестов
- ⚠️ Dev-пифолл: `npm run build` при живом dev-сервере ломает NextAuth-роуты (зависание логина) — перезапускать dev после build с `rm -rf .next`

## Push-контракт
- Remote `origin` → `https://github.com/atrshncv-design/MVP-CNTR.git`
- Backend: `codex/recovery-backend` — тикеты 20–25 запушены (последний: `de9923e`)
- Frontend: `codex/recovery-frontend` — все тикеты запушены (`4daf351` → `9c67ca9`)
- Документация: `main` — спека/журнал/статус (03.08)

## Прогресс тикетов (спека: `.scratch/mvp1-release/spec.md`)
- ✅ 01–11: инфраструктура, тесты, схема вступления, RBAC, проекты, join-механика, генерация, AI-ассистент (OpenAI-совместимый), ГОСТы в RAG (456 чанков), НИОКТР (400 карточек/188 орг.), реестры API
- ✅ 12–14: фронтенд — визард→сохранение→карточка, ЛК всех 9 ролей (JoinProjectForm, КТ-решения, админ-пользователи), ассистент (источники с УГТ/разделами ГОСТов), реестры (компетенции, организации, фильтры)
- ✅ 15: профиль + администрирование (пароль, пользователи, роли, деактивация)
- ✅ 16: семантические дизайн-токены (--tz-*) в globals.css
- ✅ 17: 66 интеграционных/юнит-тестов (включая полный демо-маршрут) — зелёные
- ✅ 18: production-стек (Dockerfile'ы, compose, nginx+HTTPS, deploy.sh, README-DEPLOY)
- ✅ 19: ручной QA в браузере — сквозной сценарий ГК подтверждён (см. ниже)

- ✅ 20–25: backend нового ядра — миграция 0010, экспресс-оценка, очереди менеджера, автозаявка N→N+1, общий реестр, документы верификации; 79 тестов зелёные
- ✅ дефект-фикс (QA open-design): `verification_documents` видны владельцу и участникам в карточке проекта (`GET /projects/{id}`), пустой список по умолчанию; 80 тестов зелёные, backend :8000 поднят
- ✅ **Публичный посадочник** (frontend `775ec99`): многостраничник на дизайн-системе 2.0 — hero с УТП, «Как это работает», 9 ролей, шкала УГТ 1–9 + детальные страницы уровней, о центре, методика, заказчики, исполнители, дорожная карта; RSC, auth-aware навигация, без моков; lint+tsc+build зелёные, браузерный QA пройден (вход менеджером → «Войти в личный кабинет»)
- **Пифолл (зафиксирован):** `npm run build` при живом dev-сервере ломает NextAuth-роуты (зависает логин) → останавливать dev, потом `rm -rf .next` и dev заново
- ✅ **Аудит фронта×бэкенд (задача open-design D1–D6, коммиты `99046bf`+`c5e8054`)**: investor/serial_manufacturer переведены на `projects/registry?ugt_min=7` (RegistryProjectOut, бюджет, статик-бейдж «В реестре»); маршрут роли `ugt_expert`→`regulating_organization` (папка переименована, roles.ts, проверено логином в браузере); API_URL fallback единый `127.0.0.1:8000`; NEXTAUTH_SECRET реальный (`.env.local`, не коммитится). **D1 не дефект**: инверсия slate/gray/neutral уже есть в `.dark` дизайн-системы 3.0 (строки 158–195 globals.css), маппинг через `var(--tz-p-*)`; дашборды сейчас светлые (ThemeToggle только в лендинге) — вопрос «тёмные ли ЛК» открыт дизайнеру. **D4 не дефект**: `api-client.ts` используется страницей `projects/page.tsx`. Gates: lint+tsc+build зелёные

- ЛК менеджера: две очереди («Новые проекты» + «Заявки на повышение УГТ»)
- Автозаявка на повышение УГТ при полноте комплекта документов этапа (N→N+1, 8 этапов)
- Словарь документов этапов: LLM по ГОСТам один раз → верификация методологом центра [PLACEHOLDER]
- Роль «Регулирующая организация» (join по токену → верифицирующие документы → материал для менеджера)

## Ручной QA (браузер, тикет 19) — подтверждено
- Регистрация (9 ролей) + вход + ЛК ГК с реальными данными
- Визард: 9 уровней → радар → «Сохранить проект» → редирект `/dashboard/project/8`
- Карточка: токен `TZ-7L68Q6`, КТ-1…КТ-4, «Копировать», «Заявки на вступление»
- Генерация ТЗ из карточки — чистый документ (без `{{...}}`), название проекта в тексте
- Чат: живой LLM-ответ по ГОСТ Р 58048-2017 (nemotron-3-ultra-free)
- Найден и исправлен баг: отсутствие SessionProvider в root layout (падали все дашборды) — `9c67ca9`

## Окружение (локально)
- PostgreSQL: docker compose (primary 5432, replica 5433), миграции на head (0009)
- Backend: uvicorn :8000 (все эндпоинты проверены живьём: health/ready/реестры/генерация/чат)
- LLM: `LLM_API_BASE=https://opencode.ai/zen/v1`, `LLM_MODEL=nemotron-3-ultra-free`, ключ в `.env`
- RAG: 456 чанков ГОСТов + шаблоны tz/passport/teo + выборка НИОКТР

## Следующие шаги
- Тикеты по спеке 03.08 (новое ядро: экспресс-оценка, очереди менеджера, автозаявка, регулирующая организация)
- Реализация новых механик → тесты → QA демо-маршрута №18
- Деплой на сервер коллег: `cd technozrelost-backend && ./infra/deploy.sh` (инструкция: `infra/README-DEPLOY.md`)
- Дизайн-проход open-design — после сдачи (по решению Functional Validator)
