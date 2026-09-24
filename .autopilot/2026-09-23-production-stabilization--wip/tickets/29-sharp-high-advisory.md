# 29 — sharp/libheif high dependency audit

**Требование:** D06. **После:** T28. **Зона:** frontend dependency lock.

RED: `npm audit --audit-level=high` показывает `sharp` high, range <0.35.4, libheif advisory (`evidence/CI-dependency-audit.md`). После T28 перепроверь, остался ли finding: если транзитивно исчез, зафиксируй evidence и не меняй файлы. Иначе обнови только нужный путь зависимости минимально до исправленной версии, проверь `npm ci`, audit, tests и build. Не делай blind `npm audit fix`; не менять шрифты, `.autopilot`, production, секреты; не коммитить.
