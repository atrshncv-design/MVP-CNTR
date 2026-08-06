# 18 — Production-стек: Docker, nginx, HTTPS, деплой

**What to build:** Dockerfile (frontend multi-stage, backend), docker-compose.prod.yml (frontend + backend + PostgreSQL + nginx), nginx (SPA + прокси `/api/v1`), Let's Encrypt (HTTPS), скрипт деплоя одной командой, `.env.production.example` (имена переменных + команда генерации секретов). Стек универсальный — сервер предоставят коллеги (TBD).

**Blocked by:** 17 — Интеграционные тесты сквозных сценариев

**Status:** ready-for-agent

- [ ] `docker compose -f docker-compose.prod.yml up` поднимает весь стек
- [ ] HTTPS работает (для проверки допустим самоподписанный сертификат)
- [ ] Деплой-скрипт + README-DEPLOY (одна команда от нуля до прода)
