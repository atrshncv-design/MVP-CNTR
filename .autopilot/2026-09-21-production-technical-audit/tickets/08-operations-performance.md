# 08 — Эксплуатация и производительность

**Требования:** R03, R06, R23–R26, R30, R31
**Blocked by:** 01, 04
**Зона:** `docs/audit/2026-09-21-production/08-operations/`
**Волна:** 8
**Status:** ready

## Что должно заработать

Read-only оценка deployment reproducibility, probes, resources, logs, monitoring, alerting, backup/restore evidence, RPO/RTO, rollback, SPOF, Redis/PostgreSQL/queues и latency. Никакого load test, restart или restore drill.

## Критерии приёмки

- [ ] Весь operations checklist spec покрыт или `UNKNOWN`.
- [ ] Текущий single-node чётко сравнён с целью 2× Dell R640.
- [ ] Latency/resources/slow queries/locks/Redis оценены только по наблюдениям; нагрузка не создана.
- [ ] Backup freshness/encryption/offsite/restore proof разделены; наличие скрипта не считается restore proof.
