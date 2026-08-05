# 18 — Масштабируемый Docker-контур

**What to build:** Собрать воспроизводимые local/production профили с разделёнными сервисами и параметризованными репликами.

**Blocked by:** 06, 12, 14 — файловые, realtime и AI зависимости

**Status:** ready-for-agent

- [ ] Контур включает Nginx, Next.js, FastAPI, PostgreSQL Primary/Replica, Redis, MinIO и ClamAV
- [ ] App слой stateless и масштабируется репликами
- [ ] Read-after-write идёт в Primary, безопасные чтения могут идти в Replica
- [ ] Health/readiness и persistent volumes настроены
- [ ] Секреты только через env, повторный запуск идемпотентен
