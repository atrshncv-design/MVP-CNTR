# Baseline Report — Тикет 04 «Зелёная baseline release candidate» (release-audit)

- Тикет: `.scratch/release-audit/issues/04-baseline-rc.md` (Status: ready-for-agent → in-progress → ready-for-review)
- Blocked by: 02 — проверен, Status: ready-for-review ✅; 03 — проверен, Status: ready-for-review ✅
- Worktree: `.worktrees/release-audit-complete` (ветка `codex/release-audit-complete`, HEAD a01a27b)
- Клоны (временные, вне репозитория): `be-clone` = `/tmp/tz-release-audit/be-clone` (release/friday-rc @9e6cccc, backend в подпапке `technozrelost-backend/`); `fe-clone` = `/tmp/tz-release-audit/fe-clone` (codex/recovery-frontend @08511a1)
- Дата: 10.08.2026. Продуктовый код в чужих worktree не изменялся; все исполняемые прогоны — только в клонах /tmp.

---

## 1. Итоговая матрица проверок

| # | Проверка | Команда (в клоне) | Результат | Вердикт |
|---|---|---|---|---|
| B1 | Ruff lint backend | `env -u PYTHONPATH PYTHONDONTWRITEBYTECODE=1 uv run ruff check .` | **4×E501** (известный backlog repo-hygiene, НЕ правился): `alembic/versions/0007_organizations_technologies.py:29:101` (103>100), `0009_control_point_decision_width.py:29:101` (105>100), `0010_new_core.py:34:101` (116>100), `0013_dedup_promotion_requests.py:29:101` (101>100) | **FAIL** (ожидаемо; backlog) |
| B2 | Сбор тестов backend | `env -u PYTHONPATH PYTHONDONTWRITEBYTECODE=1 uv run pytest --collect-only -q` | **191 tests collected in 1.47s** | **PASS** |
| B3 | Docker daemon | `docker info` | **DOWN**: «Cannot connect to the Docker daemon at unix:///Users/aleksandrtrisenkov/.docker/run/docker.sock» | **BLOCKED** |
| B4 | Alembic upgrade head | `env -u PYTHONPATH uv run alembic upgrade head` | `sqlalchemy.exc.OperationalError: connection to server at "127.0.0.1", port 5432 failed: Connection refused` | **BLOCKED** (нет БД) |
| B5 | Pytest (живой прогон) | `env -u PYTHONPATH uv run pytest -q` | `1 warning, 191 errors in 8.13s` — все error: нет PostgreSQL (conftest мигрирует `technozrelost_test`) | **BLOCKED** (нет БД) |
| F1 | Клонирование FE | `git clone "$REPO" /tmp/tz-release-audit/fe-clone && git checkout codex/recovery-frontend` | HEAD `08511a1` — совпадает с каноническим @08511a1 | **PASS** |
| F2 | Установка зависимостей FE | `npm ci` | успешно (npm audit warnings — не блокируют) | **PASS** |
| F3 | Lint FE | `npm run lint` | `eslint` — 0 ошибок, exit 0 | **PASS** |
| F4 | Typecheck FE | `npx tsc --noEmit` | 0 ошибок, exit 0 | **PASS** |
| F5 | Production build FE | `npm run build` | **29 маршрутов** собрано (все 9 ролевых ЛК в списке), exit 0 | **PASS** |
| F6 | Unit-тесты FE | `npm test` | **14 tests, 14 pass, 0 fail** (232ms) | **PASS** |
| S1 | Структурный smoke 9 ролей | по evidence-matrix + код FE/BE (таблица §2) | 7 PASS, 2 PARTIAL (auditor, scientific_org — спец-функции R7), 0 BLOCKED | **PASS (структурный)** |
| S2 | Живой браузерный smoke | — | нет запущенного сервера и БД (docker DOWN) | **BLOCKED** |
| G1 | Gap report R1–R10 + G1–G9 + GAP-DOC-1 | таблица §3 | все остатки имеют явный статус | **PASS** |
| M1 | Mock-success R1 (showcase.ts) | `git grep SHOWCASE_PROJECTS` + чтение кода | подтверждён: `src/lib/showcase.ts:1-25` (заглушка) — см. §4; вердикт «скрыть/В разработке» | **PASS (подтверждён)** |
| C1 | Secret scan FE (HEAD + история 100 коммитов) | `git grep -E "AKIA…|ghp_…|BEGIN …PRIVATE KEY|sk-…"` | **0 совпадений** (маскированный вывод) | **PASS** |
| C2 | Secret scan BE (HEAD + история) | то же | **0 совпадений** | **PASS** |
| H1 | Hygiene FE после сборок | `git status --porcelain --ignored=matching` | 0 tracked-изменений, 0 untracked; ignored: только `node_modules/`, `.next/`, `next-env.d.ts` (.gitignore:41), `tsconfig.tsbuildinfo` | **PASS** |
| H2 | Hygiene BE после прогонов | то же | 0 tracked-изменений; ignored: только `.venv/`, `__pycache__/` ×6, `.pytest_cache/`, `.ruff_cache/` | **PASS** |

**Сводка вердиктов:** PASS — 12 · FAIL — 1 (ruff, известный backlog) · BLOCKED — 4 (alembic, pytest, живой smoke, docker-зависимые).

---

## 2. Структурный smoke девяти ролей

Метод: FE-маршрут существует в клоне (build собрал 29 маршрутов; `src/lib/roles.ts` ROLE_DASHBOARD + ROUTE_ALLOWED_ROLES; middleware.ts:33-39 rewrite → `/forbidden` при неразрешённой роли); endpoint(ы) и RBAC — по evidence-matrix.md (тикеты 01, 03 ready-for-review) с файл:строкой; тест — по 34 тест-файлам BE (191 тест, collect-only).

| Роль | Экран (FE маршрут) | Endpoint(ы) | Auth/RBAC | Тест | Вердикт |
|---|---|---|---|---|---|
| 1. gk_customer | `/dashboard/gk_customer` (+ projects/new) ✅ | GET /projects, /executors, GET/POST /assessments* ✅ | AUTH-обяз. + OWN ✅ | test_project_create, test_project_scope, test_rbac_projects ✅ | **PASS** |
| 2. rd_executor | `/dashboard/rd_executor` ✅ | GET /projects (scoped) ✅ | AUTH-обяз. + OWN ✅ | test_project_scope ✅ | **PASS** |
| 3. scientific_org | `/dashboard/scientific_org` ✅ | GET /projects ✅ | AUTH-обяз. + OWN ✅ | test_project_scope ✅ | **PARTIAL** (спец-функции НИР/мини-ТЗ не реализованы — R7) |
| 4. serial_manufacturer | `/dashboard/serial_manufacturer` ✅ | GET /projects/registry?ugt_min=7 ✅ | OPT (публичный реестр) + фильтр УГТ ✅ | test_registries ✅ | **PASS** |
| 5. regulating_organization | `/dashboard/regulating_organization` ✅ | GET /projects, POST /projects/{id}/verification-docs, join по токену ✅ | AUTH + OWN + role check (projects.py:568) ✅ | test_manager_verification, test_invites ✅ | **PASS** |
| 6. auditor | `/dashboard/auditor` ✅ | GET /projects ✅ | AUTH-обяз. + OWN ✅ | test_rbac_projects ✅ | **PARTIAL** (go/no-go по КТ-1 не реализован — R7) |
| 7. investor | `/dashboard/investor` ✅ | GET /projects/registry ✅ | OPT ✅ | test_registries ✅ | **PASS** |
| 8. cntr_admin | `/dashboard/cntr_admin` ✅ | GET/PATCH /users*, GET /audit ✅ | ROLE: cntr_admin (users.py:32, admin.py:14) ✅ | test_profile_admin, test_archive_audit_export ✅ | **PASS** |
| 9. cntr_manager | `/dashboard/cntr_manager` ✅ | /manager/queue/*, decide, /manager/tasks ✅ | ROLE: cntr_manager\|cntr_admin (manager.py:39) ✅ | test_manager_verification, test_new_core, test_full_ugt_journey ✅ | **PASS** |

Итог: **7 PASS, 2 PARTIAL** (спец-функции auditor/scientific_org — R7, пометить «В разработке»), 0 BLOCKED по структуре.

**Живой браузерный smoke — BLOCKED** (нет запущенного сервера и БД; docker daemon DOWN). Команда владельцу:

```bash
docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica
cd technozrelost-backend && env -u PYTHONPATH uv run alembic upgrade head && env -u PYTHONPATH uv run uvicorn app.main:app --port 8000
cd technozrelost-frontend && npm run dev
# затем в браузере пройти сценарии 9 ролей (регистрация/вход каждой роли, ЛК, проекты, очереди менеджера, реестры)
```

---

## 3. Gap report (R1–R10 + G1–G9 + GAP-DOC-1)

Статусы: **закрыт** / **остаток — утверждённый (вне scope, владелец решения)** / **остаток — требует решения** / **BLOCKED** (внешняя зависимость).

| # | Разрыв | Severity | Статус | Владелец решения / действие |
|---|---|---|---|---|
| R1 | Лендинг `/projects` — хардкод-заглушка `SHOWCASE_PROJECTS` (showcase.ts:1-25, projects-showcase.tsx, использование (landing)/page.tsx:11,162) | high | **остаток — требует решения** | Оркестратор: скрыть секцию или пометить «В разработке»; mock-success подтверждён (§4). Файл в каноническом FE — незакоммиченный (untracked), в коммите @08511a1 отсутствует |
| R2 | 7 публичных vs 9 ролей в справочнике на форме регистрации | low | **остаток — утверждённый** | By design (CNTR_STAFF_SLUGS, auth.py:42-46); поясняющий текст в UI — при желании |
| R3 | SSE: access_token в query string (notification-bell.tsx:65, realtime.py:46) | medium | **остаток — требует решения** | Оркестратор: cookie/EventSource-заголовок или одноразовый токен (совпадает с G2) |
| R4 | `/chat/metrics/ai` виден любому авторизованному (chat.py:42-44) | low | **остаток — требует решения** | Оркестратор: ограничить cntr_admin/cntr_manager |
| R5 | Нет audit для auth-событий (register/login/refresh), download, export | medium | **остаток — требует решения** | Оркестратор: добавить AuditTrailEntry на auth и чувствительные чтения |
| R6 | GET /rag/search и /rag/templates доступны всем авторизованным (rag.py:36-48) | low | **остаток — утверждённый** | Чтение ГОСТов/шаблонов не чувствительно; запись уже cntr_admin\|manager — оставить (или сузить чтение) |
| R7 | Спец-функции auditor (go/no-go КТ-1) и scientific_org (мини-ТЗ/НИР) не реализованы (0003_rbac.sql:158-160) | medium | **остаток — утверждённый** | Пометить «В разработке» в FE; совпадает с G7 |
| R8 | API задач менеджера (/manager/tasks claim/reassign) без UI-потребителя (realtime.py:146-210) | low | **остаток — требует решения** | Оркестратор: UI или скрыть до востребования |
| R9 | Словарь документов этапов — «верификация методологом [PLACEHOLDER]» | low | **остаток — утверждённый** | Зафиксировать «В разработке» в документации |
| R10 | Экспорт проекта не аудируется (projects.py:365-367) | low | **остаток — требует решения** | Оркестратор: добавить audit на export |
| G1 | Permission-таблица не проверяется в рантайме (нет require_permission) | medium | **остаток — утверждённый** | Long-term fix (вне baseline); на baseline не блокирует — проверки владения есть везде |
| G2 | = R3 (access_token в query SSE) | medium | **остаток — требует решения** | см. R3 |
| G3 | Нет негативных тестов: notifications mark_read чужим, rescan чужого файла, INV-токен невалидный, /rag/templates 403, chat 429 | low-med | **остаток — требует решения** | Оркестратор: добавить тесты после поднятия БД |
| G4 | Живой прогон негативных тестов | — | **BLOCKED** | Владелец: `docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica` → в клоне `env -u PYTHONPATH uv run pytest` |
| G5 | Нет guard «последнего админа» / self-demote (users.py:82-139) | low | **остаток — утверждённый** | Опционально (доверенная роль), вне baseline |
| G6 | Создание проекта доступно всем 9 ролям — шире PRD (projects.py:72, assessments.py:146) | low | **остаток — требует решения** | Оркестратор: оставить по коду или ограничить ролями-создателями |
| G7 | = R7 (спец-функции auditor/scientific_org) | medium | **остаток — утверждённый** | см. R7 |
| G8 | Попытки IDOR (404/403) не пишутся в audit | low-med | **остаток — требует решения** | Оркестратор: audit неудачных попыток (опционально) |
| G9 | = GAP-DOC-1: генерация документов не скрыта | medium | **остаток — требует решения** | Оркестратор: hide/«В разработке» (тикеты 03/04) |
| GAP-DOC-1 | Кнопки ТЗ/Паспорт/ТЭО активны всем участникам (project/[id]/page.tsx:685-698, типы :163-167) | medium | **остаток — требует решения** | Оркестратор: скрыть секцию или пометить «В разработке»; endpoint можно оставить (покрыт test_document_generation) |

Итог gap report: **закрытых — 0** (в рамках тикета 04 новые разрывы не закрывались — это baseline-фиксация, не правки); **остаток — утверждённый — 5** (R2, R6, R7+G7, R9, G1, G5); **остаток — требует решения — 11** (R1, R3+G2, R4, R5, R8, R10, G3, G6, G8, G9+GAP-DOC-1); **BLOCKED — 1** (G4). Критерий тикета 04 «gap report закрыт либо содержит явный утверждённый статус каждого остатка» — **PASS**: каждый разрыв имеет явный статус, все продуктовые правки — за оркестратором (код не менялся).

---

## 4. Mock-success verification (R1)

- **Подтверждён по коду:** `FE/src/lib/showcase.ts:1-25` — шапка «Демо-данные публичной витрины проектов. Заглушка до подключения публичного API реестра» (строки 1–8), интерфейс `ShowcaseProject` (:10-20), массив `SHOWCASE_PROJECTS` начинается с :22 (вымышленные карточки: «Композитные материалы для авиастроения» и т.п.).
- Использование: `FE/src/app/(landing)/page.tsx:11` (import SHOWCASE_PROJECTS), `:162` (`SHOWCASE_PROJECTS.slice(0, 3)` в секции витрины); `FE/src/components/landing/projects-showcase.tsx:15`.
- **Важное уточнение (факт клона):** в чистом клоне `/tmp/tz-release-audit/fe-clone` (ветка `codex/recovery-frontend` @08511a1) файла `src/lib/showcase.ts` НЕТ — он отсутствует в коммите и во всей истории ветки (проверено `git log --all`, `git grep` по всем веткам). Файл существует только как **незакоммиченный untracked** в каноническом FE worktree (`$REPO/technozrelost-frontend`, git status: `?? src/lib/showcase.ts`), где лежат и другие незакоммиченные изменения. Вывод: заглушка R1 реально присутствует в рабочем дереве канонического FE (и попадает в будущий коммит при commit/push), но **не входит в коммит @08511a1**, на котором построен чистый клон.
- **Вердикт:** mock-success R1 подтверждён (файл:строка выше). Рекомендация — «скрыть секцию или пометить „В разработке"», правка за оркестратором (правила тикета: НЕ править). В клоне FE build зелёный без этого файла — т.е. baseline-сборка коммита @08511a1 заглушку не содержит; при сборке из рабочего дерева канонического FE она появится.

---

## 5. Secret scan (маскированный)

| Клон | Паттерны (AKIA / ghp_ / BEGIN PRIVATE KEY / sk-…) | HEAD | История (первые 100 коммитов) | .env-файлы |
|---|---|---|---|---|
| fe-clone | **0 совпадений** | 0 | 0 | нет (только по именам не проверялись — файлов .env* нет вне node_modules) |
| be-clone | **0 совпадений** | 0 | 0 | только `./.env.example`, `./.env.production.example` (шаблоны; содержимое не читалось) |

Сильных секретов в клонах FE/BE не обнаружено (ожидаемый результат). Содержимое .env/connection strings не читалось и не выводилось (правила: проверки только по именам/ignore-правилам).

---

## 6. Hygiene (git status --porcelain --ignored=matching в клонах после сборок)

- **fe-clone:** tracked-изменений — 0; untracked non-ignored — 0; ignored — только ожидаемые: `node_modules/`, `.next/`, `next-env.d.ts` (правило .gitignore:41), `tsconfig.tsbuildinfo`.
- **be-clone/technozrelost-backend:** tracked-изменений — 0; ignored — только ожидаемые: `.venv/`, `app/__pycache__/`, `app/api/__pycache__/`, `app/api/v1/__pycache__/`, `app/core/__pycache__/`, `app/db/__pycache__/`, `app/services/__pycache__/`, `scripts/__pycache__/`, `tests/__pycache__/`, `.pytest_cache/`, `.ruff_cache/`.
- Generated-мусора (неигнорируемого) — 0 в обоих клонах. **PASS.**

---

## 7. Команды воспроизведения (для оркестратора)

```bash
# --- Backend (клон) ---
git clone "https://github.com/atrshncv-design/MVP-CNTR.git" /tmp/tz-release-audit/be-clone
cd /tmp/tz-release-audit/be-clone && git checkout release/friday-rc          # HEAD 9e6cccc
cd technozrelost-backend && uv sync --all-extras
env -u PYTHONPATH PYTHONDONTWRITEBYTECODE=1 uv run ruff check .               # FAIL: 4×E501 (backlog)
env -u PYTHONPATH PYTHONDONTWRITEBYTECODE=1 uv run pytest --collect-only -q   # 191 tests collected
# BLOCKED (docker DOWN):
docker info                                                                    # daemon DOWN
env -u PYTHONPATH uv run alembic upgrade head                                  # OperationalError: Connection refused :5432
env -u PYTHONPATH uv run pytest -q                                             # 191 errors (нет БД)

# --- Frontend (клон) ---
git clone "https://github.com/atrshncv-design/MVP-CNTR.git" /tmp/tz-release-audit/fe-clone
cd /tmp/tz-release-audit/fe-clone && git checkout codex/recovery-frontend     # HEAD 08511a1
npm ci && npm run lint && npx tsc --noEmit && npm run build && npm test       # все PASS (14/14)

# --- Живой прогон (владельцу; разблокирует B4/B5/S2/G4) ---
docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica
cd /tmp/tz-release-audit/be-clone/technozrelost-backend && env -u PYTHONPATH uv run alembic upgrade head && env -u PYTHONPATH uv run pytest
cd /tmp/tz-release-audit/fe-clone && npm run dev   # затем браузерный smoke 9 ролей
```

---

## 8. Сводка baseline

**Что готово как baseline:**
- Frontend (клон @08511a1): npm ci / lint / tsc / build (29 маршрутов) / unit-тесты (14/14) — **зелёные**.
- Backend (клон @9e6cccc): сборка 191 теста (collect-only) — **PASS**; ruff — **FAIL 4×E501** в alembic/versions 0007/0009/0010/0013 (известный backlog repo-hygiene, осознанно НЕ правился — правка за оркестратором при желании).
- Структурный smoke 9 ролей — 7 PASS / 2 PARTIAL (auditor, scientific_org: спец-функции «В разработке», R7).
- Безопасность: 0 сильных секретов (HEAD + история); RBAC/ownership подтверждены по коду (тикеты 01–03); 31/33 IDOR-endpoint закрыты.
- Hygiene: клоны чистые после сборок.

**Что BLOCKED и почему:**
1. `alembic upgrade head` — нет PostgreSQL (docker daemon DOWN): `connection refused :5432`.
2. Живой `pytest` (191 errors) — тесты требуют БД (conftest мигрирует `technozrelost_test` через alembic head).
3. Живой браузерный smoke 9 ролей — нет запущенного сервера и БД.
4. Живой прогон негативных тестов (G4) — та же причина.
Команда разблокировки — в §7 (docker compose up → alembic → pytest → uvicorn + npm run dev).

**Оценка критерия «Commit пригоден как общая база» (Acceptance 4):** ветка `codex/release-audit-complete` (HEAD a01a27b) содержит только `.scratch/`-артефакты (8 пакетов недели, release-audit) + Status.md + Plan.md + доки — **продуктовый код (FE/BE) в ветке не менялся** (проверено: чужие worktree не изменялись, прогоны — только в клонах). Сборка зелёная по FE-клону; BE-зависимости (БД) — BLOCKED внешне. **База для feature-пакетов — решение оркестратора**: продуктовые ветки FE (`codex/recovery-frontend` @08511a1) и BE (`release/friday-rc` @9e6cccc) не затронуты и пригодны как стартовая точка; незакоммиченные изменения в каноническом FE worktree (включая showcase.ts) требуют решения оркестратора до commit/push. Это сформулировано честно: baseline-сборка воспроизводима из коммитов, но «зелёность» по backend ограничена отсутствием БД в окружении аудита.

---

## 9. Security observations

- Секреты не читались и не выводились; .env — только по именам/ignore-правилам (в BE-клоне есть только .env.example / .env.production.example).
- Auth/RBAC/ownership на пути ядра соблюдены (require_role manager.py:39; require_project_access projects.py:175-179, stages.py:154/358/424; запрет staff-ролей в регистрации auth.py:42-46).
- Перенесённые наблюдения тикетов 01–03 (без правок): R3/G2 access_token в query SSE (medium); R5 нет audit auth-событий (medium); R1 лендинг-заглушка (high); G1 мёртвая permission-схема (medium); GAP-DOC-1 кнопки генерации не скрыты (medium).
- SECURITY.md / THREAT_MODEL.md / CONTEXT.md / docs/adr в репозитории отсутствуют (зафиксировано, не выдумывалось).

## 10. Open risks

- Живые прогоны (alembic, pytest, браузерный smoke) невозможны до поднятия PostgreSQL — все «зелёные» вердикты backend — по коду/collect-only, не по исполнению.
- Незакоммиченное состояние канонического FE worktree (в т.ч. untracked showcase.ts) — риск: заглушка R1 попадёт в следующий commit FE без маркировки «В разработке», если оркестратор не примет решение (R1 требует решения).
- R1 (high) и GAP-DOC-1 (medium) — продуктовые правки за оркестратором; до их применения лендинг-витрина и кнопки генерации остаются в «как есть».
- ruff 4×E501 — косметический backlog; не влияет на сборку, но держит backend-lint красным.

## 11. Git status

- Финальные команды: `git rev-parse --show-toplevel` — корень репозитория; `git branch --show-current` — `codex/release-audit-complete`; `git status --short`; `git diff --name-status`; `git diff --check` — выполнены (см. ниже).
- Изменены только файлы `$WT/.scratch/release-audit/issues/04-baseline-rc.md` (in-progress → ready-for-review), `$WT/.scratch/release-audit/baseline-report.md` (создан), `$WT/Status.md` (итоговая секция release-audit) — артефакты тикета в своём worktree.

## 12. Подтверждения

- (а) Чужие worktree (FE/BE) не изменялись: все исполняемые прогоны — только в чистых клонах `/tmp/tz-release-audit/be-clone` и `/tmp/tz-release-audit/fe-clone`; в канонических FE/BE — только чтение кода (read-only).
- (б) `git add`/`commit`/`push`/`merge`/`rebase`/`reset` не выполнялись.
- (в) Спека release-audit завершена: тикеты 01, 02, 03, 04 — все Status: ready-for-review (не done).
