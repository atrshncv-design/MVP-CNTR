# Отчёт: 01 — Инвентаризация репозитория и секретов

Ticket: `.scratch/repo-hygiene/issues/01-inventory.md` — «01 — Инвентаризация репозитория и секретов»

Outcome: Проведена повторная read-only инвентаризация репозитория «Технозрелость» (повторная попытка v2, worktree `repo-hygiene-inventory-v2`, ветка `codex/repo-hygiene-inventory-v2`, HEAD `95781f5`). Каждый факт подтверждён реальным выводом команд в этом прогоне. Определены канонические frontend/backend, классифицированы все крупные пути, проверены на секреты рабочее дерево (10 worktree + корень) и полная история (205 коммитов). Сильных секретов не обнаружено; в истории — только синтетические тестовые значения `sk-…` в `tests/test_harness.py`. Файлы не удалялись, не перемещались; git add/commit/push/merge/deploy не выполнялись.

## Canonical applications

| Роль | Путь (worktree) | Ветка | HEAD | Стек | Обоснование |
|---|---|---|---|---|---|
| Backend | `$REPO/technozrelost-backend` | `release/friday-rc` | `9e6cccc` | Python ≥3.11, FastAPI, Uvicorn, SQLAlchemy 2.0 async + asyncpg, Alembic, pgvector, Pydantic v2, uv | README «Быстрый старт» (uv → docker compose → alembic → uvicorn); 592 tracked-файла / 69.1M; канонический seed НИОКТР `data/nioktr_all.json` (64M, dict `cards`, **16 582 карточки** — подтверждено); production-инфраструктура `infra/` (deploy.sh, backup.sh, restore.sh, compose prod, nginx, postgres, prometheus, grafana) |
| Frontend | `$REPO/technozrelost-frontend` | `codex/recovery-frontend` | `08511a1` | Next.js (App Router), next-auth, react, framer-motion, lucide-react, recharts; eslint; тесты `node --test` | package.json scripts (dev/build/start/lint/test); 67 tracked `src/`-файлов; Status.md и skill фиксируют `codex/recovery-frontend` как каноническую ветку фронтенда |

⚠️ Оба канонических worktree имеют грязные рабочие деревья (см. Open risks): код на диске ≠ HEAD (backend: 591 D / 20 ?? / 1 M; frontend: 52 M / 15 ?? / 2 D).

## Repository inventory

| Путь | Категория | Назначение | Размер | Tracked | Восстановление | Риск |
|---|---|---|---|---|---|---|
| `technozrelost-backend/` | canonical (backend) | FastAPI-бэкенд, миграции, seed, infra | 379M (69.1M tracked + .venv 280M) | да (592 файла) | из git (кроме .venv) | грязное дерево: код диска ≠ HEAD |
| `technozrelost-frontend/` | canonical (frontend) | Next.js App Router | 1.7G (1.8M tracked + node_modules 556M + .next 1.2G) | да (100 файлов) | из git (кроме node_modules/.next) | грязное дерево: часть `src/` untracked |
| `КОД MVP "0" 210726 - ТОЛЬКО ФРОНТЭНД/` | archive (legacy) | Старый фронтенд MVP0: Next.js + Prisma + bun + Caddyfile | 11M | да (в ветках c2964a2; в корневом дереве частично удалён — 127 D) | из git | низкий (исторический) |
| `ГОСТЫ/` | local-sensitive | RAG-исходники: docx (положение о центре НТР УР, паспорт №364, «Трансфер технологий») | 70M | нет (untracked, ignored только в локально изменённом корневом .gitignore) | НЕ восстановим (нет в git) | высокий (уникальные данные) |
| `Данные для тестового реестра/` | local-sensitive / duplicate | Сырой экспорт НИОКТР `nioktr_2025_all_months.json` | 395M | нет (untracked) | НЕ восстановим | дубль seed `data/nioktr_all.json` (64M) |
| `.worktrees/new-front/platform/` | removal-candidate | Конкурирующее дерево frontend (Next.js; src/app/forgot-password, reset-password и др. из истории) | 660M (вкл. node_modules) | да, частично (94 файла `platform/` в ветке `new-front`) | из ветки `new-front` (запушена: origin/new-front) | средний (ветка активна) |
| `.worktrees/new-front/` (прочее) | archive | Копия legacy «КОД MVP0», 2 docx, доки | 15M | да (в ветке new-front) | из git | низкий |
| `friday-release-candidate/` | archive (docs) | Документация Friday RC (Status.md, PROGRESS.md, тикеты 01–22) | 12M | да (ветка codex/friday-release-candidate, d004cbd) | из git | низкий |
| Корень: CLAUDE.md, Plan.md, Status.md, PRD.md, DESIGN.md, PROGRESS.md, docs/, 2 docx, `.scratch/` (8 пакетов) | canonical (docs/planning) | Мастер-спека, пакетные спеки, тикеты, статусы | ~90K tracked | да (в 95781f5; 435 файлов) | из git | низкий |
| `new-front/` (в корне) | archive (docs) | 5 md-документов: CONTEXT.md, DATA-CONTRACTS.md, Design.md, ROLES.md, ROUTES.md | 80K | нет (untracked) | НЕ восстановим | низкий (документы-справочники) |
| `.worktrees/repo-hygiene-inventory/` | archive (артефакт прошлой попытки) | Worktree предыдущей попытки тикета 01 | 14M | да (ветка codex/repo-hygiene-inventory, c2964a2) | из git | низкий (ветка не запушена, кандидат на удаление) |
| `.worktrees/front-dorabotka/`, `mvp-10-140826/`, `week-release-planning/`, `repo-hygiene-inventory-v2/` | worktree-копии | Изолированные рабочие деревья | 14M каждый | да (из своих веток) | из git | низкий |
| `.git/` | системный | Общая объектная БД (205 коммитов) | 201M | n/a | n/a | n/a |
| node_modules/.next (frontend), .venv/.pytest_cache (backend), tsconfig.tsbuildinfo | generated | Сборочные артефакты и кэши | 556M+1.2G+280M+32K+156K | нет | пересоздаются (npm/uv) | низкий |

## Removal candidates

| Путь | Причина | Размер | Tracked | Восстановление | Риск | Owner | Decision owner | Deletion approval required |
|---|---|---|---|---|---|---|---|---|
| `.worktrees/new-front/platform/` | Конкурирующее дерево frontend; дубль канонического `technozrelost-frontend` | 660M (вкл. node_modules) | да (94 файла) | из ветки `new-front` (origin/new-front запушена) | средний — ветка активна; удалять только после подтверждения владельца | не установлен (создан в ходе более ранней работы; конкретный владелец в репозитории не зафиксирован) | оркестратор + Functional Validator (ручной гейт) | да — ветка в origin; требуется подтверждение владельца/оркестратора |
| `КОД MVP "0" 210726 - ТОЛЬКО ФРОНТЭНД/` | Legacy-архив MVP0, адаптирован в канонический frontend | 11M | да | из git (полностью) | низкий — при желании перенести в `docs/archive` | не установлен (исторический артефакт проекта, импортирован 21.07) | оркестратор + Functional Validator | да — перенос в `docs/archive` меняет структуру корня |
| `Данные для тестового реестра/` | Дубль seed НИОКТР (395M сырой экспорт vs 64M `data/nioktr_all.json` — 16 582 карточки) | 395M | нет | НЕ восстановим | средний — перед удалением сверить полноту с seed и согласовать | не установлен (локальная выгрузка, в git не была) | оркестратор + Functional Validator | да — безвозвратное удаление |
| `ГОСТЫ/` | Локальные RAG-исходники, не версионируются | 70M | нет | НЕ восстановим | высокий — НЕ удалять без отдельного тикета и внешнего бэкапа | не установлен (локальные исходники, в git не были) | оркестратор + Functional Validator | да — высокий риск, нужен отдельный тикет и внешний бэкап |
| `.worktrees/repo-hygiene-inventory/` + ветка `codex/repo-hygiene-inventory` | Артефакт предыдущей попытки (ветка не запушена, HEAD = корень c2964a2) | 14M | да | из git (ветка) | низкий — удалить после принятия v2 | не установлен (создан в ходе предыдущей попытки исполнения тикета 01) | оркестратор | да — удаление worktree и локальной ветки |
| node_modules/.next/.venv/.pytest_cache/tsconfig.tsbuildinfo/.DS_Store/*.log | Сборочные артефакты, кэши, мусор | ~1.9G | нет | пересоздаются | низкий | не требуется (генерируются инструментами сборки) | оркестратор (техническое решение в тикете 03) | нет — пересоздаются; чистка в рамках тикета 03 |
| `.git_backup_mvp0/` | Рудимент в .gitignore | 0 (НЕ существует на диске и в истории — проверено) | нет | n/a | n/a | n/a (не существует) | n/a | n/a — удалять нечего; достаточно убрать рудимент из `.gitignore` в тикете 02 |

## Potential secrets

Working tree (все 10 worktree + корень, tracked-файлы, `git grep -nI -oE`): **не обнаружено** (0 совпадений).

История (205 коммитов, `git grep` по `git rev-list --all`, вывод замаскирован):

| Тип | Путь | Commit | Маска |
|---|---|---|---|
| `sk-[A-Za-z0-9]{20,}` (синтетическое тестовое значение) | `tests/test_harness.py` | 2f3763f, 33030a6, 35594a2, 4ffbac9, e119003 | `2f3763f…` |
| `sk-[A-Za-z0-9]{20,}` (синтетическое) | `technozrelost-backend/tests/test_harness.py` | 9e6cccc, a8f85c6, be54109 | `9e6cccc…` |

AKIA\*, `-----BEGIN … PRIVATE KEY`, `ghp_…`, `xox…` в истории: **0 совпадений**. `postgres://` в истории (`git log -S`): **0**. Файлы `*.pem`/`*.key`/`*credential*`: **не найдены**.

.env-файлы (untracked, содержимое НЕ выводилось; указаны путь/размер/строки/имена переменных):
- `technozrelost-backend/.env` — 4.0K, 29 строк; переменные: APP_ENV, APP_NAME, APP_HOST, APP_PORT, LOG_LEVEL, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_REPLICA_HOST, POSTGRES_REPLICA_PORT, DB_SCHEMA_PUBLIC, DB_SCHEMA_TEST, VECTOR_DIMENSION, LLM_API_BASE, **LLM_API_KEY**, LLM_MODEL, CORS_ORIGINS.
- `technozrelost-frontend/.env.local` — 4.0K, 4 строки; переменные: **NEXTAUTH_SECRET**, NEXT_PUBLIC_API_URL, AUTH_TRUST_HOST, API_URL_INTERNAL.
- `КОД MVP "0" …/.env` — 4.0K, 1 строка; переменная: **DATABASE_URL**.
- `technozrelost-backend/.env.example` / `.env.production.example` — шаблоны (в т.ч. JWT_SECRET, MINIO_ACCESS_KEY, MINIO_SECRET_KEY — имена-заглушки).

В истории (.env-файлы tracked): только `.env.example`, `.env.production.example` (ветки `codex/recovery-backend`, `release/friday-rc`); в HEAD 95781f5 — .env-файлов нет. Ложные срабатывания по словам «env/passw»: `alembic/env.py`, страницы `forgot-password`/`reset-password`, документ `.agents/ENVIRONMENT.md`.

## Branches and worktrees

Ветки (16 локальных; запушена = существует `origin/<имя>` или настроен upstream):
- Запушены: `main` (upstream origin/main), `main-backup-2026-08-05` (upstream origin/main), `codex/friday-release-candidate`, `codex/recovery-backend`, `codex/recovery-docs`, `codex/recovery-frontend`, `codex/week-release-planning`, `feat/backend`, `feat/frontend`, `new-front` (origin/new-front есть; upstream не настроен), `release/friday-rc` (origin/release/friday-rc есть; upstream не настроен).
- НЕ запушены (нет origin/*): `MVP-10-140826`, `front-dorabotka`, `codex/видениепроектадо310826` (активная ветка корневого worktree), `codex/repo-hygiene-inventory`, `codex/repo-hygiene-inventory-v2` (текущая).

Worktree (путь → ветка → HEAD):

| Путь | Ветка | HEAD |
|---|---|---|
| `$REPO` (корень) | `codex/видениепроектадо310826` | c2964a2 |
| `.worktrees/front-dorabotka` | `front-dorabotka` | c2964a2 |
| `.worktrees/mvp-10-140826` | `MVP-10-140826` | c2964a2 |
| `.worktrees/new-front` | `new-front` | 0ca7c06 |
| `.worktrees/week-release-planning` | `codex/week-release-planning` | 95781f5 |
| `.worktrees/repo-hygiene-inventory` | `codex/repo-hygiene-inventory` | c2964a2 (старая попытка) |
| `.worktrees/repo-hygiene-inventory-v2` | `codex/repo-hygiene-inventory-v2` | 95781f5 (текущий) |
| `friday-release-candidate` | `codex/friday-release-candidate` | d004cbd |
| `technozrelost-backend` | `release/friday-rc` | 9e6cccc |
| `technozrelost-frontend` | `codex/recovery-frontend` | 08511a1 |

Всего коммитов: `git rev-list --all | wc -l` = **205** (совпадает с ожиданием). Remote: `origin https://github.com/atrshncv-design/MVP-CNTR.git`.

## Current build/test baseline

Команды выписаны из манифестов, **НЕ запускались** (тикет read-only):
- Frontend (`technozrelost-frontend/package.json`, scripts): `npm run dev` (`next dev`), `npm run build` (`next build`), `npm run start` (`next start`), `npm run lint` (`eslint`), `npm test` (`node --test tests/*.test.mjs`). Отдельного `typecheck`-скрипта в package.json НЕТ — tsc запускается вручную (в Status.md упоминается gate «lint+tsc+build»).
- Backend (`technozrelost-backend/README.md` + `pyproject.toml`):
  - `uv sync --all-extras` (установка зависимостей)
  - `cp .env.example .env` (окружение)
  - `docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica` (БД)
  - `uv run alembic upgrade head` (миграции)
  - `uv run uvicorn app.main:app --reload --port 8000` (dev-сервер)
  - `uv run python -m app.db.reset_demo --full` / `--seed-only` (сброс+seed; seed = 16 582 карточки НИОКТР из `data/nioktr_all.json`)
  - `uv run pytest`, `uv run ruff` — в README явно не перечислены; конфиги `[tool.pytest.ini_options]`, `[tool.ruff]` присутствуют в pyproject.toml
- Production: `infra/deploy.sh`, `infra/backup.sh`, `infra/restore.sh`, `docker-compose.prod.yml`, каталоги `nginx/`, `postgres/`, `prometheus/`, `grafana/` (все существуют).

## Acceptance criteria

1. **Каждый крупный путь классифицирован** (canonical/archive/generated/local-sensitive/removal-candidate) — **PASS**: таблица Repository inventory (13+ путей), каждому присвоена категория с назначением, размером, tracked-статусом, восстановимостью и риском.
2. **Working tree и полная история проверены на секреты; значения секретов не попали в отчёт** — **PASS**: `git grep` по 10 worktree + корень — 0 совпадений; по 205 коммитам — 8 совпадений, все синтетические `sk-…` в `tests/test_harness.py`, значения замаскированы (`2f3763f…` и т.п.), содержимое .env не выводилось.
3. **Для каждого кандидата на удаление указаны причина, размер, владелец и способ восстановления** — **PASS**: таблица Removal candidates (7 записей) дополнена отдельными полями `Owner`, `Decision owner`, `Deletion approval required` с честными значениями; где владелец в репозитории не зафиксирован, указано «Owner: не установлен» (никто не выдуман), решение об удалении — ручной гейт оркестратора/Functional Validator.
4. **Текущие frontend/backend сборки и тесты зафиксированы как baseline** — **PASS**: точные команды выписаны из package.json/README/pyproject (секция Current build/test baseline); сборки и тесты НЕ запускались по условиям read-only тикета.

## Verification commands

Реально выполнены (ключевые результаты):
- `git rev-parse HEAD` (в $WT) → `95781f52996fb191c5ebac97f5c9ee10e3b17423` ✓; `git status --short` (в $WT) → пусто ✓ (до правок); наличие 4 обязательных файлов .scratch → OK ✓
- `git worktree list` → 10 worktree + корень (HEAD-ы см. таблицу) ✓
- `git branch -a`, `git for-each-ref --format='%(refname:short) %(upstream:short)' refs/heads`, `git remote -v` → origin=MVP-CNTR.git, upstream-карта веток ✓
- `git rev-list --all | wc -l` → 205 ✓
- `du -sh` по всем worktree: корень 3.5G, frontend 1.7G, backend 379M, new-front 675M, ГОСТЫ 70M, Данные 395M, остальные 12–14M ✓
- `git ls-files` (count + size): backend 592/69.1M; frontend 100/1.8M; корень 381; v2-worktree 435/8.7M ✓
- Артефакты: node_modules 556M, .next 1.2G, .venv 280M, .pytest_cache 32K, tsconfig.tsbuildinfo 156K ✓
- `git status --short` по чужим worktree: корень 138 (8 ??, 127 D, 3 M), backend 612 (20 ??, 591 D, 1 M), frontend 69 (15 ??, 52 M, 2 D), front-dorabotka 1 (?? .scratch/udmurt-only-redesign/), остальные чистые ✓
- Дефект .gitignore: `xxd` первой строки → литеральные `\n` (`.DS_Store\nnode_modules/…`); `git check-ignore` для node_modules/, .env, __pycache__/, *.log, .DS_Store → пусто (НЕ игнорируются); в 95781f5 .gitignore не содержит строк ГОСТЫ//.scratch/ (они только в локально изменённом корневом файле); `.DS_Store` виден как `??` в корне — подтверждение дефекта ✓
- `.git_backup_mvp0` → ABSENT (на диске, в git ls-files, в истории не найден) ✓
- Секреты: `git grep -nI -oE '<5 сильных паттернов>'` по 10 worktree → 0; по `$(git rev-list --all)` → 8 (все `sk-…` в test_harness.py, по типам паттернов подтверждено, значения замаскированы); `git log --all --name-only | grep -iE 'env|secret|key|credential|passw|\.pem'` → только .env.example/.env.production.example + ложные (alembic/env.py, password-страницы, .agents/ENVIRONMENT.md); `git log --all -S 'postgres://' | wc -l` → 0 ✓
- .env-метаданные: 5 untracked .env-файлов (пути/размер/строки/имена переменных, без значений) ✓
- `data/nioktr_all.json`: 64M, dict, `cards` = **16 582** записи ✓
- Baseline: package.json scripts, README команды, pyproject секции, ls infra/ (deploy/backup/restore) ✓

## Security observations

- Сильных секретов нет: ни в рабочем дереве, ни в истории. Единственные срабатывания — синтетические `sk-…` в тестовом файле (8 вхождений в 8 коммитах), значения в отчёт не выводились.
- Дефект `.gitignore` (литеральные `\n` в первой строке) подтверждён повторно: `node_modules/`, `.env`, `.env.local`, `__pycache__/`, `*.log`, `.DS_Store`, `dist/`, `build/`, `.venv/` фактически НЕ игнорируются. Риск: случайный `git add .` закоммитит `.env` (реальные ключи: backend LLM_API_KEY, frontend NEXTAUTH_SECRET, legacy DATABASE_URL) или сотни МБ артефактов.
- В закоммиченной версии .gitignore (95781f5/HEAD корня) отсутствуют строки `ГОСТЫ/`, `Данные для тестового реестра/`, `.scratch/`, `friday-release-candidate/` — они добавлены только в рабочем дереве корня (локальная незакоммиченная правка).
- 5 untracked .env-файлов на диске (см. Potential secrets) не версионируются, но из-за дефекта .gitignore не защищены от случайного добавления.
- `postgres://`-строк в истории нет (0); `.pem`/`.key`/credential-файлов не найдено.
- `.git_backup_mvp0/` — рудимент в .gitignore, не существует.

## Open risks

- **Грязные чужие worktree (не мои, не трогал):** корень 138 изменений (в т.ч. 127 удалений в legacy «КОД MVP0» — рабочее дерево корня отличается от HEAD c2964a2); backend 612 (591 удаление + 20 untracked); frontend 69 (часть `src/` untracked, `??`). При любом merge/checkout возможна потеря локальных untracked-изменений. Требует отдельного разбирательства до тикета 02.
- `ГОСТЫ/` (70M) и `Данные для тестового реестра/` (395M) не версионируются — без внешнего бэкапа невосстановимы.
- Дефект `.gitignore` не исправлен (это не scope тикета 01 — read-only; исправление — в 02-canonical-layout).
- Ветки `codex/видениепроектадо310826` (корень), `MVP-10-140826`, `front-dorabotka`, `codex/repo-hygiene-inventory` не запушены — риск потери при локальной аварии.
- `release/friday-rc` и `new-front` существуют на remote, но upstream у локальных веток не настроен — при push может создаться расхождение.
- Владельцы путей в репо формализованы слабо; для удаления «Данных для тестового реестра» и `.worktrees/new-front/platform` нужно явное подтверждение владельца.
- Мой отчёт `inventory-report.md` появится в git status как `??` (в 95781f5 `.scratch/` не игнорируется) — оркестратору учесть при коммите.

## Git status

Финальные проверки (выполнены после правок):
- `git rev-parse --show-toplevel` → `/Users/aleksandrtrisenkov/Desktop/ЦЕНТР ТЕХНОЛОГИЧЕСКОГО РАЗВИТИЯ/MVP ПЛАТФОРМЫ 2/.worktrees/repo-hygiene-inventory-v2` (= $WT) ✓
- `git branch --show-current` → `codex/repo-hygiene-inventory-v2` ✓
- `git status --short` → ровно 3 записи:
  ```
   M .scratch/repo-hygiene/issues/01-inventory.md
   M Status.md
  ?? .scratch/repo-hygiene/inventory-report.md
  ```
- `git diff --name-status` → `M .scratch/repo-hygiene/issues/01-inventory.md`, `M Status.md` (третий файл — untracked, в diff не попадает) ✓

Изменено ровно 3 разрешённых файла; ничего другого в $WT не изменено.

## Подтверждения

- (а) Файлы не удалялись и не перемещались (в т.ч. в чужих worktree).
- (б) `git add` / `git commit` / `git push` / merge / deploy не выполнялись.
- (в) Изменены ТОЛЬКО три разрешённых файла в $WT: новый `inventory-report.md` (A), `issues/01-inventory.md` (B — Status: ready-for-review), `Status.md` (C — запись о тикете 01).
- (г) Следующий тикет (02-canonical-layout) не начинался.
