# 06 — Кабинеты ролей
**Status:** in-progress
**Blocked by:** 03
- Последовательно привести 9 ролей к общему layout.
- Сохранить реальные API-контракты и RBAC.
- Балансировать данные, действия и следующий шаг.
- Убрать визуальные дубли и мёртвые контролы.

---

**Status:** ready-for-review

**Что сделано (тикет 06, ветка codex/internal-ux-redesign):**
- Все 9 ролевых кабинетов + профиль + AI-ассистент приведены к единому layout-паттерну:
  заголовок (tz-eyebrow + tz-page-title + описание), статистика на tz-card/tz-stat
  (данные из реальных API, без захардкоженных значений), основной блок данных
  (списки/таблицы/реестры), боковая колонка «действия и следующий шаг»
  (AssessUgTCard + ролевые формы), честные loading/error/empty состояния
  (tz-empty + tz-btn «Повторить»), светлая тема, токены --tz-*, без dark:-классов.
- Убраны дублирующие глобальную навигацию tab-бары (<nav>) и мёртвые
  якорные ссылки (#join/#registry) со всех кабинетов.
- Убраны мёртвые/дублирующие контролы; все оставшиеся ссылки ведут на реальные
  маршруты (заявка /dashboard/gk_customer/projects/new, реестры, проект, профиль).
- Баланс «данные / действия / следующий шаг»:
  - gk_customer: статистика + список проектов + быстрые действия (реальные маршруты),
    empty-state с CTA «Создать первую заявку».
  - rd_executor / scientific_org: статистика + проекты + вступление по токену.
  - serial_manufacturer: статистика (производные от реестра) + технологии УГТ 7+ + JoinProjectForm.
  - regulating_organization: статистика + проекты с документами + VerificationDocsPanel + JoinProjectForm.
  - auditor: статистика Go/No-Go + контрольные точки с реальными PATCH-решениями.
  - investor: статистика (из реестра) + фильтры + реестр только для чтения + честная
    подсказка следующего шага (без мёртвых кнопок).
  - cntr_admin: статистика (+ «Организации») + таблица пользователей (сохранение в API)
    + кнопка «Обновить список».
  - cntr_manager: уже соответствовал паттерну — оставлен, проверен.
  - profile: заголовок, tz-card/tz-input/tz-btn, «Следующий шаг» по фактическому
    состоянию (draft/pending/verified/rejected), организации.
  - ai-assistant: приведена шапка к общему виду (tz-eyebrow + tz-page-title).
- API-контракты и RBAC не менялись: middleware.ts, auth.config.ts, src/lib/roles.ts,
  src/lib/api-client.ts, src/lib/more-menu.ts не тронуты; кабинеты — только представление.

**Files:**
- src/app/dashboard/gk_customer/page.tsx (переписан, паттерн тикета 06)
- src/app/dashboard/rd_executor/page.tsx (переписан)
- src/app/dashboard/scientific_org/page.tsx (переписан)
- src/app/dashboard/serial_manufacturer/page.tsx (переписан)
- src/app/dashboard/regulating_organization/page.tsx (переписан)
- src/app/dashboard/auditor/page.tsx (переписан)
- src/app/dashboard/investor/page.tsx (переписан)
- src/app/dashboard/cntr_admin/page.tsx (переписан)
- src/app/dashboard/profile/page.tsx (переписан)
- src/app/dashboard/ai-assistant/page.tsx (шапка — единый паттерн)
- src/app/dashboard/cntr_manager/page.tsx (проверен, без изменений — уже в паттерне)

**Checks:**
- npm run lint: 0 errors (8 warnings — пре-существующие, в src/components/landing/*)
- npx tsc --noEmit: clean
- npm test: 15 pass / 2 fail — фейлы пре-существующие baseline
  (tests/theme-logic.test.mjs, login exposes the approved product identity) — не чинились
- Браузерная проверка http://localhost:3001: PARTIAL — нет тестовой учётки
- npm run build не запускался (тикет 08; при живом dev ломает NextAuth)
