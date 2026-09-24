# T31 — React effect в подсказке верификации организации

Дата: 2026-09-24. Code commit `5b1a6cd`, отправлен в `origin/autopilot/production-stabilization`.

- RED: полный `npm run lint` падал только на `react-hooks/set-state-in-effect` в `org-verification-hint.tsx:39`; отдельный `_params` в `api-client.ts:677` был warning.
- Diff — один компонент, 9 insertions/15 deletions. Внешний компонент возвращает `null` при loading/no token, иначе монтирует token-keyed child. Child начинает с `loading`, асинхронно переходит в ready/error; cleanup отменяет запись результата после смены токена, выхода или unmount. Синхронные state writes из effect удалены. Независимое read-only review: PASS по scope, lifecycle, hook order и отсутствию межсессионного stale data.
- Независимые проверки: focused `npx eslint src/components/project-create/org-verification-hint.tsx` exit 0; полный `npm run lint` exit 0 (0 errors, 1 pre-existing warning); `npm test` 238 passed; `API_URL_INTERNAL=http://backend:8000 npm run build -- --webpack` exit 0, 53 страницы. Штатный Turbopack локально ограничен sandbox worker permission.
- Ограничение: `OrgVerificationHint` экспортируется, но сейчас не импортируется страницами; существующие Node-тесты проверяют отсутствие компонента в create pages. В проекте нет React component test harness, поэтому прямой runtime-тест переходов сессии не добавлен. Для узкого lint-дефекта focused ESLint был RED до фикса и GREEN после; при повторном вводе компонента в продуктовый путь нужен runtime regression test.
- Production, backend, БД, секреты и шрифты не затрагивались.
