# 28 — Next.js critical dependency audit

**Требование:** D05. **Приоритет:** security/CI high. **Зона:** frontend package/lock и минимальные совместимые тесты.

RED: `npm audit --audit-level=high` exit 1; `next` в диапазоне 16.0.0–16.3.2 помечен critical (включая AVIF image optimization RCE). Точный advisory и текущий locked version перепроверь перед edit (`evidence/CI-dependency-audit.md`).

Официальный [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) указывает patched `next` **16.3.3**; это минимальная проверяемая цель, но перед обновлением перепроверь актуальный advisory и `npm audit`.

Выбери минимальный patched Next release, совместимый с уже установленным React/next-intl/NextAuth; не делай массовый `npm audit fix` без ревью diff. Сначала lock-only/минимальный bump, затем `npm ci`, `npm audit --audit-level=high`, `npm test`, lint и production build с CI `API_URL_INTERNAL`. Если после Next bump остаются независимые sharp/browserslist findings, не закрывай их здесь; T29/T30. Не менять шрифты, production, `.autopilot`, секреты; не коммитить.
