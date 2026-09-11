# 03 — Frontend, маршруты и клиентская безопасность

**Требования:** R03-R10, R20, R21, R24, R34, R35
**Blocked by:** —
**Зона:** `evidence/03-frontend-audit.md`
**Волна:** 1
**Status:** ready

## Что должно заработать

Проверены все App Router surfaces, guards/roles, API consumers, forms, error/loading/empty,
double submit, navigation loss, stale/race/optimistic state, XSS и token/offline storage.

## Критерии приёмки

- [ ] Составлена полная route/role/API матрица
- [ ] Отдельно проверены кабинеты, проекты, реестры, команды, документы, поиск и matching
- [ ] UI-защита сверена с backend enforcement
- [ ] Находки имеют строки и сценарии; неподтверждённое маркировано честно
- [ ] Evidence написан, продукт не изменён
