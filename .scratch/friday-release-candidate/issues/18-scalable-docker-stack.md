# 18 — Масштабируемый Docker-контур

**What to build:** Собрать воспроизводимые local/production профили с разделёнными сервисами и параметризованными репликами.

**Blocked by:** 06, 12, 14 — файловые, realtime и AI зависимости

**Status:** done

- [x] Контур включает Nginx, Next.js, FastAPI, PostgreSQL Primary/Replica, Redis, MinIO и ClamAV
- [x] App слой stateless и масштабируется репликами
- [x] Read-after-write идёт в Primary, безопасные чтения могут идти в Replica
- [x] Health/readiness и persistent volumes настроены
- [x] Секреты только через env, повторный запуск идемпотентен


## Реализация (05.08.2026)
- Backend `35b0c3f`: production-контур — primary/replica PostgreSQL, 2 реплики backend, minio, clamav, redis, nginx; чтение реестров через replica (DATABASE_REPLICA_URL); healthchecks; entrypoint с advisory lock. **177/177 pytest**.