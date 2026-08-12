# 02 — Меню функций и навигация
**Status:** ready-for-review
**Blocked by:** 01
- Сетка иконка + название без крупных бейджей.
- Ролевые пункты фильтруются backend-доступом и картой маршрутов.
- «В разработке» — маленький вторичный бейдж.
- Keyboard/Escape/focus/outside-click.

Files:
- src/lib/more-menu.ts (расширен: добавлен пункт «Исполнители» /dashboard/executors с isReady: false — будущая функция реестра специалистов (тикет 05); добавлен getVisibleMenuItems(userRoles) — ролевая фильтрация через allowedRolesFor из src/lib/roles.ts, тот же источник истины, что у middleware)
- src/components/dashboard/more-functions-menu.tsx (расширен: проп userRoles → фильтрация пунктов getVisibleMenuItems; бейдж «В разработке» получает базовый класс tz-badge (tz-badge tz-badge-neutral) — маленький вторичный; keyboard/focus/Escape/outside-click уже были, проверены и сохранены)
- src/components/dashboard/header-nav.tsx (проброс userRoles в MoreFunctionsMenu)
- src/components/dashboard/mobile-nav.tsx (проброс userRoles в HeaderNav — мобильное меню фильтруется так же)
- src/app/dashboard/layout.tsx (session.user.roles → userRoles в HeaderNav и MobileNav; roles.ts/middleware.ts не тронуты)
- tests/ui-shell.test.mjs (добавлен тест ролевой фильтрации «Больше функций»)

Ролевая карта (проверено по ROUTE_ALLOWED_ROLES):
- Реестры /dashboard/technologies — все 9 ролей; НИОКТР /dashboard/nioktr — все (нет в карте); Организации /dashboard/organizations — все (нет в карте); Профиль /dashboard/profile — все залогиненные (нет в карте)
- Документы /dashboard/ai-assistant — скрыт для auditor/investor/regulating_organization (в карте: gk_customer, rd_executor, scientific_org, serial_manufacturer, cntr_admin, cntr_manager)
- Исполнители /dashboard/executors — скрыт для auditor/investor/regulating_organization (в карте: без них)

Checks:
- npm run lint — 0 errors, 8 pre-existing warnings (landing/*, не трогаемые файлы)
- npx tsc --noEmit — clean (exit 0)
- npm test — 9/11 pass; 2 fail — pre-existing на baseline c4f0794 (theme-logic: src/lib/theme.ts изменён baseline-снапшотом; login-page: тест «ТЕХНОЗРЕЛОСТЬ» в login — файлы вне скоупа тикета); новый тест тикета 02 — pass
- Browser: PARTIAL — dev :3001 жив; визуальная проверка ролевой фильтрации требует сессии (тестовых учёток нет); RBAC middleware не тронут
