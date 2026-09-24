# T29 — sharp/libheif high advisory

Дата: 2026-09-24. Code commit `47016eb`, отправлен в `origin/autopilot/production-stabilization`.

- RED: после T28 `npm audit --audit-level=high` показывал high `sharp` из-за libheif; scope — только `technozrelost-frontend/package-lock.json`.
- Diff: transitive `sharp` 0.35.3 → 0.35.4, соответствующие платформенные пакеты и `@img/sharp-libvips-*` 1.3.2 → 1.3.3. `package.json`, frontend-код и другие файлы не менялись. `git diff --check` PASS.
- Исполнитель повторил `npm ci` после обновления lock; независимый `npm ls sharp --all` показал `next@16.3.3 → sharp@0.35.4`. Lock-проверка: `next=16.3.3`, `sharp=0.35.4`, `@img/sharp-libvips-linux-x64=1.3.3`.
- Независимые проверки: `npm test` — 238 passed; `API_URL_INTERNAL=http://backend:8000 npm run build -- --webpack` — exit 0, TypeScript и 53 страницы. `npm audit --audit-level=high --json` — 0 critical, 1 high `browserslist`; `sharp` в findings отсутствует. Полный lint остаётся на отдельном D08/T31; штатный Turbopack локально EPERM на worker process.
- Production, backend, БД, секреты и шрифты не затрагивались.
