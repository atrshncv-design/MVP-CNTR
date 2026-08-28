# Тикет 05 — Инфра лимиты/логи/nginx/DR (INF-08,INF-09,INF-12,INF-13,N-18)

**Требования:** R17,R18,R19,R20,R21
**Зависит от:** —
**Зона:** `technozrelost-backend/infra/docker-compose.prod.yml`, `nginx/nginx.prod.conf:41`, `docs/RUNBOOK-DR.md`, `technozrelost-backend/app/api/v1/nioktr.py`

## Задача
`INF-08` `deploy.resources.limits` `INF-09` `logging max-size`, `INF-12` `resolver 127.0.0.11` `limit_req` `gzip` `cache _next/static`, `INF-13` `DR-runbook` `stop→чистая БД→restore→start` `restore.sh`, `N-18` `rate limit` реестров.

## Приёмка
- [ ] `docker compose config` валиден, `nginx -t` зелёный, `DR` runbook в `docs/`

## Связи
`spec Истории 15-19` `13-` `20-`
