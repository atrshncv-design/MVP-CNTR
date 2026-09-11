# 02 — Backend, API и разграничение доступа

**Требования:** R03-R10, R18, R19, R23-R25
**Blocked by:** —
**Зона:** `evidence/02-backend-api-security.md`
**Волна:** 1
**Status:** ready

## Что должно заработать

Маршрут-за-маршрутом проверены validation, errors, ownership/RBAC, BOLA, mass assignment,
инъекции, pagination, транзакции, races, limits, файлы, audit trail и background semantics.

## Критерии приёмки

- [ ] Полный router/dependency inventory, не выборка очевидных endpoint’ов
- [ ] Проверены чужое чтение/изменение/удаление, admin bypass и hidden fields
- [ ] Каждый серьёзный кандидат имеет точные строки и реалистичный attack scenario
- [ ] Отсутствие проблемы тоже обосновано ключевыми защитными швами
- [ ] Evidence написан, продукт не изменён
