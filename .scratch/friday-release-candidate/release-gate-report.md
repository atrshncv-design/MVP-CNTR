# Release Gate — отчёт (тикет 22)

Дата: 05.08.2026. Вердикт: **CONDITIONAL → PASS после фиксов B1** (публичные
реестры), resubmit отклонённых драфтов, backup.sh fallback.

## Гейты

| Гейт | Команда | Результат |
|---|---|---|
| Backend ruff | `uv run ruff check app/ tests/ scripts/` | ✅ PASS |
| Backend pytest | `uv run pytest -q` | ✅ **190 passed** |
| Alembic | `uv run alembic current` | ✅ head=0023, БД на head |
| Frontend lint | `npm run lint` | ✅ PASS |
| Frontend tsc | `npx tsc --noEmit` | ✅ PASS |
| Frontend tests | `npm test` | ✅ 5/5 |
| Frontend build | `npm run build` | ✅ PASS (30+ маршрутов) |
| Compose local/prod | `docker compose config -q` | ✅ PASS |
| Docker ps | — | ✅ tz-pg-primary/replica/minio healthy; clamav up (базы FreshClam не скачаны — CDN заблокирован в dev, на сервере заработает) |
| Backup | `infra/backup.sh` | ✅ после фикса `e119003` (PGPASSWORD в docker-fallback); корректный путь: 14.5 МБ, pg_restore --list OK |
| Security | `python -m scripts.security_check --repo .` | ⚠️ secrets=0, RBAC/IDOR/FILE все PASS; DEPS: только ecdsa 0.19.2 CVE-2024-23342 (Minerva, **фикса нет**) + rsa archived — задокументированы в infra/README-LOADTEST.md |
| Публичные реестры | `GET /api/v1/projects/registry` без токена | ✅ **200** (после фикса B1 `35594a2`; nioktr/executors — 200) |

## E2E

- Опросник 1–9 → preliminary 9 → cap УГТ 2 + draft ✅; менеджерский approve → published, УГТ 2 ✅.
- Reject/fix/resubmit: draft-reject с причиной ✅; **resubmit отклонённого драфта реализован** (переоценка rejected-проекта владельцем, `35594a2`).
- Заявки N→N+1: чистый файл → pending_manager → approve (мок-сканер); в live-режиме ClamAV-базы недоступны (fail-safe, как спроектировано) и live-LLM нестабилен — заявка может остаться `evaluation_unavailable` (внешний сервис, не баг платформы).
- RBAC/IDOR/приватность/реестры/экспорт — PASS (см. security_check + ручные проверки).

## Темы/браузер

Три темы (светлая/dark/udmurt) реализованы (`7a6795f`); контраст токенов до WCAG AA (`7a08999`); browser matrix — docs/browser-matrix.md. Frontend dev на `http://localhost:3000` (Next 16 — не 127.0.0.1).

## Runbook (infra/README-DEPLOY.md)

Структура «3 шага + одна команда `./infra/deploy.sh`» соответствует спеке US 91. Замечания: (1) docker-fallback backup.sh без PGPASSWORD давал 0-байтный dump — исправлено; (2) seed ГОСТ/НИОКТР — отдельный шаг после запуска (`uv run python -m app.db.reset_demo --full` на сервере); (3) prod compose ожидает структуру каталогов `MVP ПЛАТФОРМЫ 2/technozrelost-backend + technozrelost-frontend`.

## Несоответствия трекеров (исправлены в docs `…`)

- Тикет 14 закрыт документационно (issue → done, docs-коммит).
- PROGRESS.md/Status.md приведены в соответствие: 22/22 done.
