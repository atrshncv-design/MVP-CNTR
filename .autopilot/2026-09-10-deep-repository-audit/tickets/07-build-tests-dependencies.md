# 07 — Сборка, зависимости, тесты и CI

**Требования:** R03-R10, R17, R31, R32, R42i
**Blocked by:** —
**Зона:** `evidence/07-build-tests-dependencies.md`
**Волна:** 1
**Status:** ready

## Что должно заработать

Безопасно проверены locked install, frontend/backend gates, API smoke через test seam,
dependency conflicts/audits, CI parity и реальная сила тестового покрытия.

## Критерии приёмки

- [ ] Все штатные безопасные gates запущены с точными результатами или BLOCKED
- [ ] Ни lockfiles, ни dependencies manifests не изменены
- [ ] Критические отсутствующие сценарии и слабые source-contract tests перечислены
- [ ] Любая ошибка имеет команду, вывод, root file/line и влияние
- [ ] Evidence написан; живые сервисы/контейнеры не перезапущены
