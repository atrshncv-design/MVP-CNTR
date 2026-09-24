# 30 — browserslist high dependency audit

**Требование:** D07. **После:** T28. **Зона:** frontend dependency lock.

RED: `npm audit --audit-level=high` показывает `browserslist` high, range <=4.28.6, OOM/prototype-write advisories (`evidence/CI-dependency-audit.md`). После T28 перепроверь фактический lock: если patched транзитивно, только evidence; иначе минимально обнови нужную зависимость, проверив `npm ci`, audit, tests и build. Не делать массовый audit fix и не менять продуктовые интерфейсы, `.autopilot`, production или секреты; не коммитить.
