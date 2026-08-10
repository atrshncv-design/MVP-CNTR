# 05 — Воспроизводимый Docker Compose deploy

**What to build:** Документированный staging stack Nginx + Next.js + FastAPI + PostgreSQL Primary/Replica с TLS, internal network, health checks и rollback.

**Blocked by:** 04 — Блокирующий security CI; release-audit/04 — Зелёная baseline release candidate.

**Status:** ready-for-agent

- [ ] Публичны только необходимые HTTPS endpoints; БД и служебные порты закрыты.
- [ ] Dev/test/staging configs разделены; secret values отсутствуют в repo.
- [ ] Clean server deploy, health/readiness и rollback воспроизводимы по инструкции.
- [ ] Production deploy не выполняется этим тикетом.
