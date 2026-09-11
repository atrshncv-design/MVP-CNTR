# 06 — DevOps, production security и восстановление

**Требования:** R03-R10, R24-R27, R33, R42i
**Blocked by:** —
**Зона:** `evidence/06-devops-production.md`
**Волна:** 1
**Status:** ready

## Что должно заработать

Проверены Docker/Compose/nginx/CI/deploy, secrets, privileges, probes, migrations/rollback,
backup/PITR/offsite, alerts/logs/tracing, resources/volumes, versioning и parity.

## Критерии приёмки

- [ ] Dev/test/prod wiring сверена по фактическим resolved contracts
- [ ] Проверены non-root/capabilities/network/internal exposure/secret defaults
- [ ] Backup/restore/rollback не объявлены рабочими без live evidence
- [ ] Graceful shutdown, resource limits и failure domains оценены
- [ ] Evidence написан без запуска/остановки контейнеров и deploy
