# 04 — БД и защита данных

**Требования:** R03, R11, R12, R14, R26, R30, R31
**Blocked by:** 01
**Зона:** `docs/audit/2026-09-21-production/04-database/`
**Волна:** 4
**Status:** ready

## Что должно заработать

Статическая ORM/migrations-модель сопоставлена с production schema metadata, constraints, indexes, sizes и aggregate counts. Ни одна business row не читается.

## Критерии приёмки

- [ ] Весь DB/data-protection checklist spec покрыт доказательно или `UNKNOWN`.
- [ ] Migration head/drift, ORM/schema mismatches, constraints/indexes/roles/network/backup encryption и isolation отражены.
- [ ] Проверка injection опирается на ORM/query construction и tests, без destructive payloads.
- [ ] Отчёт и findings JSON не содержат ПДн или значения секретов.
