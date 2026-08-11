# STATUS — release-integration (release candidate)

Worktree: `.worktrees/release-integration` · Ветка: `codex/release-integration` · Основа: **c4f0794** (frontend design baseline)
Правила: main/чужие worktree не трогать; push/deploy/settings — нет; интеграция — только здесь.
Дата: 11.08.2026 · HEAD: c4f0794 (коммитов нет — все изменения в рабочей директории)

## Этапы

| Этап | Содержание | Статус |
|---|---|---|
| 1 | Baseline c4f0794 зафиксирован (frontend в корне: src/, public/ с дизайн-ассетами, tests/) | ✅ |
| 2 | **internal-frontend**: NEW+ SAME (23 файла), 3-way merge 11 файлов, страницы ролей (9) + project/[id] (feature-канон), dashboard/layout → DashboardShell (единый владелец — intfe); theme-toggle НЕ восстановлен (baseline: одна тема); конфликты разобраны вручную | ✅ |
| 3 | **mvp1 frontend**: 3-way 4 файла (profile, project/[id], technologies — OK; cntr_manager — ручная дельта: AssessUgTCard + история попыток), NEW promotion-history-panel + mvp1-panels.test | ✅ |
| 3.5 | **mvp1 backend**: 12 файлов (projects.py promotion-history, technologies competencies, ai_assistant _rag_lookup, load_gosts CLI, schemas, тесты) | ✅ |
| 4 | Shell/roles/navigation: единый владелец — internal-frontend (shell.tsx/nav.tsx/navigation.ts из intfe; roles.ts SAME; theme-toggle удалён дизайном) | ✅ |
| 5 | **identity-organizations** — 42 файла (миграции 0024–0027, MFA/consents/account) | ✅ |
| 6 | **ai-rag** — 29 файлов (RAG-сервисы, 0028–0030) | ✅ |
| 7 | **requests-matching** — 21 файл (tech_requests, matcher, 0031–0034) | ✅ |
| 8 | **operations-modules** — 27 файлов (stages/experts/РИД/меры/аналитика) | ✅ |
| 9 | **security-infrastructure** — 20 файлов (kill-switches, security_metrics, uploads) | ✅ |
| 10 | Миграции консолидированы: **единый head 0038** (requests 0031→down=0030; ops перенумерованы 0035–0038) | ✅ |

## Гейты (актуальные)
- Frontend: lint 0 errors, tsc 0, **npm test 86/86**, build OK.
- Backend: IMPORT OK; ruff только 4×E501 backlog; pyright 0; **полный pytest 532 passed / 1 skipped / 0 failed**; /health 200, /ready 200 (primary+replica ok); secret scan 0; diff-check 0.

## Ручные merge-решения (конфликты)
- conftest.py: консолидирован (MFA-ключ identity + таблицы всех веток).
- schemas.py: 7 конфликтных зон — сохранены оба блока (requests + ops/security схемы) + TechRequestDocumentOut поля восстановлены.
- admin.py: identity-аудит/MFA/deletion + ops-аналитика + security-kill-switches.
- main.py: identity/requests-роутеры + ops (stages/experts/ip/support).
- auth.py: identity+MFA+consents + security (ensure_enabled registration, security_metrics ×5).
- projects.py: mvp1+ops+identity + security (ensure_enabled external_access в /registry).
- Миграции: дубли 0024/0032/0033/0034 — перенумерованы (ops→0035–0038), requests 0031 down→0030; единый head 0038.

## Дизайн-решения (зафиксированы)
1. Страницы ролей (9) — из internal-frontend (функциональный канон кабинетов); визуал на tz-токенах (globals.css — baseline). Точечная дизайн-дельта baseline внутри переработанных страниц (хардкод-цвета → var(--tz-*)) — НЕ переносилась автоматически (риск); зафиксировано как finding.
2. ~~TolezeLogo (бренд baseline) в shell НЕ встроен~~ — **устаревший промежуточный finding**: TolezeLogo добавлен в DashboardShell (corrective pass, проверено в браузере :3001); design pass остаётся только для токен-нормализации страниц ролей.
3. theme-toggle: baseline удалил (одна утверждённая тема) — НЕ восстанавливаем; shell адаптирован (импорт/рендер убраны); тест theme-logic переписан под канон одной темы.
4. public/ — дизайн-ассеты baseline трекаются (в отличие от feature-worktree); clean-clone-тест адаптирован.
5. Тесты адаптированы под интеграционную реальность: theme-logic (одна тема), clean-clone (public с ассетами), responsive-a11y (theme-toggle→wizard), ui-shell login (baseline-бренд), пути backend в mvp1-panels/secondary-workspaces.

## Запреты соблюдены
git add/commit/push/merge/rebase/deploy — НЕ выполнялись; секреты не читались (.env скопирован из mvp1-worktree для uv sync — имя файла-конфига, содержимое не выводилось).

## Corrective pass (11.08, финал)
- Git-прозрачность: staging снят (git restore --staged, без удаления/reset); diff --cached пуст; diff --check 0; 28 M + 26 ?? в рабочем дереве.
- Регистрация через UI — PASS (terms/privacy → submit → /login; API 201).
- Вход через UI — PASS (NextAuth authorize → :8001 через API_URL_INTERNAL; /dashboard/gk_customer).
- DashboardShell + TolezeLogo — PASS (проверено в браузере, скриншоты).
- Гейты: frontend audit 0/lint 0/tsc 0/86-86/build OK; backend ruff backlog/pyright 0/pytest 532+1skip (повторён дважды); alembic head 0038; health/ready 200; secret scan 0; nanoid 3.3.18.
- Baseline :3000 не трогался; изолированная БД technozrelost_integration @ 0038.

## Pre-commit audit (11.08, финал)
- Состав RC зафиксирован (инвентарь: .scratch/release-integration/untracked-inventory.md): код+тесты+миграции+infra+scripts+шаблоны env+SECURITY/THREAT_MODEL — в RC; .env/.env.local/.venv/node_modules/.next/__pycache__/.scratch/nioktr_all.json — вне RC.
- .gitignore-фикс подготовлен (не закоммичен): .scratch/, negation .env.example.
- SECURITY.md и THREAT_MODEL.md добавлены в RC (из security-infrastructure).
- Гейты актуальны: pytest 532/1/0, frontend 86/86, lint 0, tsc 0, build PASS, audit 0, alembic head 0038, health/ready 200, secret scan 0; staged — 0; diff-check — 0.
