# T30 — browserslist high advisory

Дата: 2026-09-24. Code commit `cd7632a`, отправлен в `origin/autopilot/production-stabilization`.

- RED: после T29 `npm audit --audit-level=high` показывал high `browserslist` версии 4.28.6.
- Diff ограничен `technozrelost-frontend/package-lock.json`: browserslist 4.28.6 → 4.28.7 и соответствующие registry metadata/dependency ranges. `package.json` и продуктовые файлы не менялись; `git diff --check` PASS.
- Исполнитель выполнил чистый `npm ci`; независимый `npm ls browserslist --all` подтвердил 4.28.7. Независимый `npm audit --audit-level=high` exit 0: 0 critical/high, 3 moderate (`baseline-browser-mapping`, `uuid` через `exceljs`). Массовый `npm audit fix` не применялся.
- Независимые `npm test` — 238 passed; `API_URL_INTERNAL=http://backend:8000 npm run build -- --webpack` — exit 0, TypeScript и 53 страницы. Штатный Turbopack локально ограничен sandbox permission, а lint остаётся на D08/T31.
- Production, backend, БД, секреты и шрифты не затрагивались.
