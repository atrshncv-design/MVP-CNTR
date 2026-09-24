# T28 — Next.js critical advisory

Дата: 2026-09-24. Code commit `f0f8b0a`, отправлен в `origin/autopilot/production-stabilization`.

- RED: GitHub Actions frontend job run `35958291085` остановился на `Dependency audit`; локальный `npm audit --audit-level=high` показал Next critical в диапазоне 16.0.0–16.3.2. Официальный GHSA-2xp9-vwfh-vxw4 указывает patched 16.3.3.
- Diff ограничен `package.json`/`package-lock.json`: Next 16.3.0 → 16.3.3, соответствующие @next env/SWC; lock нормализовал hoisting @swc/helpers. Реактовые зависимости и продуктовые файлы не менялись. Независимый review PASS, peer ranges совместимы.
- Независимые проверки: `npm ci` exit 0 (529 packages audited); `npm audit --audit-level=high --json` exit 1, но **0 critical**, Next отсутствует среди findings; остаются high sharp/browserslist (T29/T30) и 3 moderate. `npm test` exit 0, 238 passed. `API_URL_INTERNAL=http://backend:8000 npm run build -- --webpack` exit 0, TypeScript прошёл, 53 страницы сгенерированы. Штатный Turbopack build локально по-прежнему EPERM на worker process, не на Next dependency или font fetch.
- `npm run lint` exit 1: предсуществующий `react-hooks/set-state-in-effect` в `src/components/project-create/org-verification-hint.tsx:39` (D08/T31); warning `_params` в `api-client.ts:677`. В T28 вне scope, не маскировалось.
- Production, секреты и шрифты не затрагивались.
