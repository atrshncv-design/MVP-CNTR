# Интерфейсы прогона

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|--------|---------|------------|--------|
| `evidence` | протокол и безопасные выдержки | `evidence ID -> source, command, result, timestamp` | санитайзинг и сырые логи |
| `feature-matrix` | статус каждой функции | CSV с фиксированной схемой из spec | черновую инвентаризацию |
| `findings` | дефекты/риски/долг/рекомендации | JSON с фиксированной схемой из spec | рабочие заметки |
| `ai-registry` | AI/RAG entrypoints и controls | JSON-реестр по схеме spec | prompt/response с риском данных |
| `report` | выводы, risk, 30/60/90, gate | Markdown со ссылками на IDs | сырые транскрипты |

## Правила исполнителя

- Проект: Next.js 16 + FastAPI + PostgreSQL/pgvector + Redis + MinIO + ClamAV + nginx.
- Не менять код продукта, production, схему БД, `.autopilot/`, `AGENTS.md` и `docs/adr/`.
- Писать только в явную зону таска в `docs/audit/2026-09-21-production/`.
- Не читать значения `.env`, credential store, private keys и файлов достпа; секреты — только имена.
- Production — только read-only/low-rate. Запрещены writes, DDL, migrations, seeds, restart, deploy, restore, fuzz, load, DNS/firewall/secrets changes.
- Недоступное доказательство → `UNKNOWN`, а не догадка.
- Отсутствуюющую зависимость не ставить: вернуть `BLOCKED: <имя> — <причина>`.
- Не коммитить. Не менять spec, tickets, interfaces и dashboard.

## Команды проверки

- Backend: `cd technozrelost-backend && uv run ruff check app tests infra/alerter scripts/udgu_ingest`; `uv run mypy app`; `uv run pytest -q`.
- Frontend: `cd technozrelost-frontend && npm test`; `npm run build`.
- Production URL: `https://technozrelost.atrshnjc.beget.tech/`.
- SSH target: `root@213.139.209.165`, deployment `/opt/technozrelost`; аутентификацию выполняет уже настроенный SSH, не файл доступов.

## Выходы тасков

- Каждый рабочий отчёт ссылается на evidence IDs и проверяет JSON/CSV syntax.
- Сырые transcripts и логи не коммитятся.
- Финальный отчёт должен быть самодостаточен.

## T01 — Baseline evidence

- Evidence contract: `EV-### -> source, timestamp, target, command, exit/status, sanitized result, requirement/spec links`.
- Baseline index: `docs/audit/2026-09-21-production/00-evidence/README.md`; environment summary: `docs/audit/2026-09-21-production/01-environments.md`.
- Production facts: deployment checkout `~/MVP-CNTR`, running SHA/image `f06b15c`, 12/12 containers healthy, replica `not_configured`.
- Cross-ticket facts: `server-path-differs-from-spec`; `deploy-log-trail-behind-running`.
- Config evidence exposes only key names and `set|empty`; raw env/log/config values are never an interface.

## T02 — Feature transfer map

- Canonical machine-readable map: `docs/audit/2026-09-21-production/02-features/feature-matrix.csv`; 33 rows `F-001`…`F-033` and the fixed 12-column schema from the spec.
- Status vocabulary remains closed: `EXPECTED`, `LOCAL_ONLY`, `SERVER_ONLY`, `DEPLOYED_WORKING`, `DEPLOYED_BROKEN`, `PARTIALLY_DEPLOYED`, `DISABLED`, `STUB`, `UNKNOWN`.
- Current distribution: 4 `DEPLOYED_WORKING`, 25 `EXPECTED`, 3 `STUB`, 1 `DISABLED`; authenticated production behavior remains `UNKNOWN` until safe test accounts exist.
- Static inventory interface: 26 FastAPI routers, 36 SQLAlchemy tables, 35 Alembic revision files, public/auth/dashboard frontend route groups, jobs, flags, integrations and AI entrypoints.
- No code is declared dead: candidates are only `alive` or `indeterminate` until imports, runtime registration, jobs, reflection and external consumers are checked.

## T04 — Database and data protection

- Static DB inventory distinguishes 36 declarative `__tablename__` classes plus 3 Core association `Table` objects, for 39 `Base.metadata` tables.
- Production catalog evidence `EV-013`: applied migration version `0037`, 41 public base tables, PK 41 / FK 55 / unique 12 / check 8, 150 index rows, role/grant names, database/table sizes and aggregate row counts only.
- `alembic_version=0037` proves migration-version parity only; schema/content/manual drift remains `UNKNOWN` until definitions or checksums are reconciled.
- R14 static seams: `Role`/`Permission`, `require_role`/`has_role`, `Project.created_by`, `ProjectMember`, `can_access_project`, `ProjectInvite`, `require_project_admin`; authorized production runtime remains `UNKNOWN`.
- No business rows or credential values were read or stored; production catalog queries were SELECT-only through existing container-environment passthrough.

## T05 — Application security and RBAC

- Security evidence: `EV-016` public security headers, `EV-017` static auth/RBAC/OWASP inventory, `EV-018` green non-DB acceptance set, `EV-018b` explicit local-DB environment blocker.
- Findings interface: `SEC-01`…`SEC-05` in `docs/audit/2026-09-21-production/05-security/findings.json`, including the fixed finding schema plus `effort` and `risk`.
- Static access seams remain role + ownership + active membership/invite; authenticated production behavior remains `UNKNOWN` until approved test accounts exist.
- Execution provenance for this ticket: `autopilot-opencode` with `opencode-go/muse-spark-1.3-contributor`; credentials were neither read nor recorded.

## T06 — Production UX/UI

- Browser evidence: `EV-019` public-route pass at 1920/768/375, `EV-020` keyboard/language/menu interaction probes, `EV-021` label probe with its timestamp limitation stated explicitly.
- UX artifacts: `docs/audit/2026-09-21-production/06-ux/ux.md`, `findings.json`, two machine-readable pass files and 41 PNG screenshots.
- Findings interface: `UX-01`…`UX-02` use the common R26 schema with `effort` and `risk`; authorized screens remain `UNKNOWN` until safe test accounts exist.
- `check_ux.py` is the in-zone artifact gate: 2 findings, 41 screenshots and all three required viewport classes.

## T07 — AI/RAG registry and eval

- Canonical registry: `docs/audit/2026-09-21-production/07-ai/ai-registry.json`, 6 entries using the exact 17-field spec schema.
- AI evidence: `EV-022` static inventory, `EV-023` offline eval and gates, `EV-024` request-cap/denylist/tenant proof; original collection instant is unavailable and bounded by file metadata, with exact re-verification UTC recorded.
- Safe evaluation used 32 checklist tokens and 0 live calls out of the 200-call cap; this is distinct from the independently repeated 32-passed non-DB pytest set.
- Findings `AI-01`…`AI-05` use the R26 schema; live synthesis, rerank, citations, outage behavior and authenticated tenant isolation remain `UNKNOWN` without safe test accounts.

## T08 — Operations and performance

- Operations evidence: `EV-025` static/read-only inventory with original collection instant unavailable, a metadata-bound UTC and exact re-verification UTC.
- Findings `OPS-01`…`OPS-06` use the 21-key R26 schema (19 spec fields plus `effort` and `risk`).
- The report separates backup freshness, encryption/offsite controls and restore proof; no load, restart or restore drill was executed.
- Current production is a single-node topology; the comparison to the target 2× Dell R640 is documented without claiming that the target is deployed.

## T03 — Code quality and architecture (recovered)

- Architecture and data-flow map: `docs/audit/2026-09-21-production/03-code/architecture.md`; code-quality inventory and evidence boundaries: `hardcode-stubs-deadends.md`.
- Python and frontend JS/TS definition/import inventories are separate and reproducible from the worktree root; they are name inventories, not semantic clone detection.
- Semantic duplication, uninspected raw-SQL paths, complete unused-dependency status and runtime dead-code claims remain `UNKNOWN` where evidence is insufficient.
- Local gates preserve exact observed outcomes and environment blockers; findings use the common machine-readable schema.
