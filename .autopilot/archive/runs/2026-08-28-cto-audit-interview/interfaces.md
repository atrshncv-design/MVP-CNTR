# Interfaces — границы и правила для интервью-прогона

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `interview/artifacts` | ответы 01, карта 02, риски 03, реестры 04, геймификация 05, сервер 06, план 07, смета 09, видение 11 | `Большое интервью 280826/` | — |
| `backend/UGT` | комплектность `stages.py:202` | `POST /stage-document-file` + `promotion.pending` `manager.py:44` | HMAC |
| `backend/RAG` | контуры `tuno/kaba` `rag_documents.contour` | `POST /chat/tuno\|kaba` `rag.py:26` | embeddings |
| `infra` | 5К 84ГБ 2 хоста /10К 166ГБ 3 хоста, RPO 5м, RTO 1ч | `deploy.sh` health-gate `alerter.py` | тома/секреты |
| `frontend/access` | OAuth Yandex/VK `auth.config.ts:22` | `CLIENT_API_BASE` `public-api.ts:30` | env |

## Правила проекта (не выводить самостоятельно)

- Стек: Python 3.11+ / FastAPI / async SQLAlchemy 2.0 / alembic 0028+; Next.js 16 App Router / TS strict.
- Команды проверки: `cd technozrelost-backend && uv sync --extra dev && uv run pytest -q && uv run ruff check . && uv run mypy app`; `cd technozrelost-frontend && npm run lint && npm test && npm run build`.
- Тестам бэкенда нужен `docker compose -f technozrelost-backend/infra/docker-compose.yml up -d pg-primary pg-replica`; conftest создаёт `technozrelost_test` + `alembic upgrade head`.
- Комментарии/докстринги — по-русски, «почему». ID Serial/BigSerial, Hash для точного, B-Tree для диапазонов.
- Работа на ветке `autopilot/m0-security-hardening` или новой от `main`; push в origin после каждого таска.
- Секреты — только имена `TELEGRAM_BOT_TOKEN`, `LLM_API_KEY`, значений в отчётах нет.

## Швы для тестов

- `pytest` 334 + `node --test` 39 + `security_check.py` + `loadtest.py` 714/1428 RPS p95≤500мс
- Тикет 01 — смета — без кода, приёмка = чек-лист в `docs/СЕРВЕР-ТРЕБОВАНИЯ.md` + `09-смета v2`

## Что уже построено (интервью-прогон)

- `Большое интервью 280826/01-ответы.md` — 14 ответов дословно
- `02-карта-системы-1-страница.md` — поток и SPOF
- `03-риски-и-техдолг.md` — BACKLOG 65
- `04-реестры-и-Туно-Каба.md` — контуры
- `05-геймификация.md` — 66 медалей аудит
- `06-сервер-10К.md` — вес пользователя + 5К 84 vs 10К 166
- `09-смета-бюджет-и-локальная-LLM.md` v1 — неверен, тикет 01 пересчитает
- `10-тикет-смета.md` — тикет для сметчика
- `11-видение-главы-единое-окно-НТР.md` — единое окно + мэтчинг
- `tickets/01-smeta-budget.md` — тикет для сметчика (передать)
