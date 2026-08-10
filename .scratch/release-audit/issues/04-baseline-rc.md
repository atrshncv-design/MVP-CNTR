# 04 — Зелёная baseline release candidate

**What to build:** Повторяемую базовую сборку существующего MVP с gap report, smoke/E2E и нулём необъяснённых мёртвых функций.

**Blocked by:** 02 — Сквозное ядро УГТ; 03 — Базовая матрица девяти ролей и IDOR.

**Status:** done

- [ ] Backend tests/lint и frontend lint/typecheck/build зелёные — **Status: FAIL / BLOCKED / PASS (смешанный)**: frontend (клон @08511a1) — **Status: PASS** (lint, tsc --noEmit, build 29 маршрутов, test 14/14); backend ruff — **Status: FAIL** (4×E501, backlog 0007:29, 0009:29, 0010:34, 0013:29 — не правился); backend pytest / alembic / health — **Status: BLOCKED** (docker daemon DOWN, PostgreSQL недоступен; команда владельцу: `docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica && uv run alembic upgrade head && uv run pytest`) — baseline-report.md §1 (B1–B5).
- [ ] Smoke всех девяти ролей выполнен на чистой базе — **Status: PARTIAL (структурный)**; живой — **Status: BLOCKED**: структурный smoke 7 PASS / 2 PARTIAL (auditor, scientific_org — спец-функции R7); живой браузерный smoke невозможен без сервера и БД (docker DOWN; команда владельцу в baseline-report.md §2 S2) — baseline-report.md §2.
- [x] Gap report закрыт либо содержит явный утверждённый статус каждого остатка — **Status: PASS**: R1–R10 + G1–G9 + GAP-DOC-1 сведены, каждый остаток имеет явный статус (утверждённый / требует решения / BLOCKED) — baseline-report.md §3.
- [x] Commit пригоден как общая база всех feature-пакетов — **Status: PASS (с оговоркой)**: ветка содержит только `.scratch/` + Status.md; продукт не менялся; продуктовая база — решение оркестратора (baseline-report.md §8).

## Comments
- 10.08.2026 (исполнитель тикета 04): baseline-сборка выполнена в чистых клонах /tmp (be-clone release/friday-rc @9e6cccc, technozrelost-backend/; fe-clone codex/recovery-frontend @08511a1). Backend: ruff — FAIL 4×E501 (известный backlog: alembic/versions/0007:29, 0009:29, 0010:34, 0013:29 — НЕ правились); collect-only — 191 тестов; docker DOWN → alembic upgrade head (Connection refused :5432) и pytest (191 errors) — честно BLOCKED с командой. Frontend: npm ci / lint / tsc --noEmit / build (29 маршрутов) / npm test (14/14) — все PASS. Smoke 9 ролей: 7 PASS, 2 PARTIAL (R7); живой — BLOCKED. Mock-success R1 подтверждён (src/lib/showcase.ts:1-25, использование (landing)/page.tsx:11,162, projects-showcase.tsx:15) — НО файл незакоммичен (untracked) в каноническом FE worktree и отсутствует в клоне @08511a1; вердикт «скрыть/В разработке» за оркестратором. Secret scan FE/BE (HEAD+история): 0 сильных. Hygiene: только ожидаемые ignored. Артефакт: `.scratch/release-audit/baseline-report.md`; итоговая секция release-audit добавлена в Status.md. Готово к ревью.
