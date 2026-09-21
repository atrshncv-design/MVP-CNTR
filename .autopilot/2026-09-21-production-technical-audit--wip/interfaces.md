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
