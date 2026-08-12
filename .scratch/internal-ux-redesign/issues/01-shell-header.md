# 01 — Shell и шапка
**Status:** ready-for-review
**Blocked by:** none
- Компактная шапка с утверждённым набором пунктов.
- Кнопка «Больше функций» открывает/закрывает dropdown по клику и вне панели.
- Цвет, границы и шрифты контрастны; нет переполнения.
- Mobile shell: логотип + кнопка меню.

Files:
- src/app/dashboard/layout.tsx (переработан: логотип + 3 пункта + «Больше функций» + уведомления + профиль + выход; skip-link сохранён; mobile — логотип + бургер)
- src/lib/more-menu.ts (новый: MORE_MENU_LABEL + MORE_MENU_ITEMS — Реестры/НИОКТР/Организации/Документы/Профиль, иконки lucide, href, isReady; источник истины карты маршрутов — src/lib/roles.ts)
- src/components/dashboard/more-functions-menu.tsx (новый, client: dropdown — клик/вне/Escape, aria-expanded/haspopup/controls, фокус в панель и возврат на кнопку, сетка карточек иконка+название, маленький бейдж «В разработке» через tz-badge-neutral)
- src/components/dashboard/header-nav.tsx (новый, client: навигация Рабочий стол/Проекты/Заявки + «Больше функций», active-state через usePathname, режим vertical для mobile)
- src/components/dashboard/mobile-nav.tsx (новый, client: кнопка меню, панель с теми же пунктами, закрытие по клику/вне/Escape)
- tests/ui-shell.test.mjs (обновлён под новую структуру: 3 пункта в шапке, остальные в more-menu; добавлен тест dropdown-поведения)

Checks:
- npm run lint — 0 errors, 8 pre-existing warnings (landing/*, не трогаемые файлы)
- npx tsc --noEmit — clean (exit 0)
- npm test — 8/10 pass; 2 fail — pre-existing на baseline c4f0794 (login page без строки «ТЕХНОЗРЕЛОСТЬ» и theme-logic: src/lib/theme.ts изменён самим baseline-снапшотом), файлы не в скоупе тикета
- Browser: PARTIAL — dev :3001 жив, /login 200, /dashboard 307 → /login (RBAC не тронут); визуальный осмотр шапки требует сессии (тестовых учёток нет)
