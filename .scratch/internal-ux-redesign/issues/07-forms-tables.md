# 07 — Формы, таблицы и фильтры
**Status:** ready-for-review
**Blocked by:** 04, 05
- Единые поля, labels, validation, error states и touch targets.
- Табличные операции не теряют фильтры и сортировку.
- Средняя плотность и отсутствие наложений.

Files:
- src/components/ui/fields.tsx (новый: TextField, SelectField, TextAreaField, FormAlert — единые поля с label/htmlFor, required, error state с aria-describedby, touch targets ≥40px)
- src/components/join-project-form.tsx (переведён на ui/fields: токен, роль; error state)
- src/components/project-files-panel.tsx, project-team-panel.tsx, request-comments-panel.tsx, stage-progress-panel.tsx, verification-docs-panel.tsx, profile-verification-queue.tsx (единые поля/error states, aria)
- src/app/join/[token]/join-token-client.tsx (единые поля)
- src/app/dashboard/investor/page.tsx и др. кабинеты (единые labels/error states — паттерн тикета 06 сохранён)
- Проверено: табличные операции проектов/реестров (тикеты 04/05) сохраняют фильтры/сортировку/пагинацию через URL+localStorage — не ломались

ВАЖНО (инцидент и ремонт): субагент при записи файлов скопировал из замаскированного вывода `***` вместо `Bearer ${…}` и потерял открывающий бэктик template literal в 27 местах / 14 файлах (Authorization-заголовки). Обнаружено по падению tsc (сотни TS1005/TS1160). Систематически исправлено: `Authorization: *** ${` → ``Authorization: `Bearer ${`` во всех 14 файлах. После ремонта: lint 0 errors, tsc clean, тесты зелёные.

Checks:
- npm run lint — 0 errors, 8 pre-existing warnings (landing/*)
- npx tsc --noEmit — clean (exit 0)
- npm test — 15/17 pass; 2 fail — pre-existing на baseline c4f0794 (theme-logic: src/lib/theme.ts; login-page: «ТЕХНОЗРЕЛОСТЬ» в login)
- git diff --check — чисто
- Browser: PARTIAL (без тестовой учётки у субагента; полный визуальный QA — тикет 08)
