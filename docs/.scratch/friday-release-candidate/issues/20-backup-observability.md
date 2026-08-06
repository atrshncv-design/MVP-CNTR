# 20 — Backup, restore и наблюдаемость

**What to build:** Обеспечить проверяемое резервирование и минимальную наблюдаемость server-ready стенда.

**Blocked by:** 18, 19 — production-контур и данные

**Status:** done

- [x] Backup/restore покрывает PostgreSQL и MinIO
- [x] Восстановление проверяет контрольные суммы
- [x] Структурированные логи не содержат секретов/персональных данных
- [x] Метрики покрывают HTTP, DB, очереди и хранилище
- [x] Grafana показывает базовый dashboard и алерты
- [x] Deploy выполняет backup до миграций


## Реализация (05.08.2026)
- Backend `23c4774`: infra/backup.sh + restore.sh (sha256sum, ротация 14), /api/v1/metrics (Prometheus: HTTP/DB/очередь/хранилище), JSON-логи с redact (Bearer/key/email), Grafana dashboard + Prometheus provisioning, backup перед миграциями. **184/184 pytest**.