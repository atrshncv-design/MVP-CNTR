# 04 — База данных, миграции и запросы

**Требования:** R03-R10, R22, R23, R26, R27
**Blocked by:** —
**Зона:** `evidence/04-database-migrations.md`
**Волна:** 1
**Status:** ready

## Что должно заработать

ORM и вся Alembic-линейка проверены на целостность, constraints/indexes, data loss,
rollback, concurrency/locks, N+1, unbounded reads, FTS/vector search и ПДн.

## Критерии приёмки

- [ ] Модели сопоставлены с миграциями и фактическими predicates/order
- [ ] Проверены FK/cascade/unique/null/check/orphan/duplicate/soft-delete/history
- [ ] Миграции проверены на линейность, downgrade, транзакционность и loss paths
- [ ] Query/performance кандидаты подтверждены call-site и индексом
- [ ] Evidence написан, постоянная БД не изменена
