# 03 — Общий layout и состояния
**Status:** in-progress
**Blocked by:** 01
- Широкая рабочая область, сворачиваемые боковые панели, единый breadcrumb.
- Loading/error/empty/success states без mock-success.
- Responsive 320/768/1440 и reduced motion.

Реализация (каркас для тикетов 04–06):
- **Широкая рабочая область**: `main` в dashboard/layout.tsx расширен с
  max-w-[1280px] до max-w-[1440px] (как у шапки) + `w-full`, px-паддинги
  сохранены; шапка и её пункты (тикеты 01–02) не тронуты.
- **CollapsibleSidebar** (src/components/dashboard/collapsible-sidebar.tsx,
  client): title/children/icon (ReactNode)/defaultOpen; состояние открыто/свернуто
  в localStorage (ключ tz-sidebar-<id>); кнопка-заголовок с aria-expanded/
  aria-controls, chevron; свёрнутое тело — inert; анимация CSS-переходом
  grid-template-rows 0fr↔1fr (.tz-sidebar-collapse в globals.css), при
  prefers-reduced-motion переход обнуляется глобальным правилом. Демо — на
  /dashboard/projects (панель «Навигация по разделу», lg:grid-cols-[260px_1fr]).
- **Единый breadcrumb**: src/components/dashboard/breadcrumb.tsx (server-safe,
  aria-label="Хлебные крошки", последний элемент aria-current="page") +
  dashboard-breadcrumb.tsx (client: BreadcrumbProvider + useBreadcrumb +
  DashboardBreadcrumb — цепочка по умолчанию из usePathname «Рабочий стол /
  <раздел>» с русскими метками сегментов). Подключён в dashboard/layout.tsx
  над {children} — обязателен на всех внутренних страницах; страницы могут
  переопределить через useBreadcrumb.
- **Состояния**: src/app/dashboard/loading.tsx (skeleton с animate-pulse +
  motion-reduce:animate-none, aria-busy), src/app/dashboard/error.tsx (client,
  role="alert", кнопка «Повторить» → reset). Error/empty на страницах уже были
  (projects, gk_customer) — сохранены. Mock-success не создавался: только
  реальные состояния на реальных данных.
- **Responsive 320/768/1440**: body overflow-x: clip (не ломает sticky-шапку);
  шапка не переполняется на 320 (wordmark lg+, nav md+, профиль sm+, бургер);
  сетка демо-панели схлопывается в одну колонку на mobile.
- **Reduced motion**: в globals.css уже были scoped-правила; добавлено
  глобальное @media (prefers-reduced-motion: reduce) — animation-duration/
  transition-duration/scroll-behavior для всех элементов.

**Status:** ready-for-review

Files:
- src/app/dashboard/layout.tsx (main → max-w-[1440px] + w-full; BreadcrumbProvider + DashboardBreadcrumb над {children}; шапка не изменена)
- src/components/dashboard/collapsible-sidebar.tsx (новый — сворачиваемая боковая панель, localStorage tz-sidebar-<id>, aria-expanded, inert, CSS-анимация)
- src/components/dashboard/breadcrumb.tsx (новый — презентационный breadcrumb, aria-label="Хлебные крошки", aria-current="page")
- src/components/dashboard/dashboard-breadcrumb.tsx (новый — BreadcrumbProvider, useBreadcrumb, DashboardBreadcrumb с цепочкой из usePathname)
- src/app/dashboard/loading.tsx (новый — skeleton-состояние, animate-pulse + motion-reduce:animate-none)
- src/app/dashboard/error.tsx (новый — граница ошибок, client, «Повторить»/reset)
- src/app/globals.css (body overflow-x: clip; глобальное prefers-reduced-motion; .tz-sidebar-collapse 0fr↔1fr)
- src/app/dashboard/projects/page.tsx (демо CollapsibleSidebar «Навигация по разделу»; error/empty состояния сохранены)
- tests/ui-shell.test.mjs (добавлен тест тикета 03: breadcrumb/панели/loading/error)

Checks:
- npm run lint — 0 errors, 8 pre-existing warnings (landing/*, не трогаемые файлы)
- npx tsc --noEmit — clean (exit 0)
- npm test — 10/12 pass; 2 fail — pre-existing на baseline c4f0794 (theme-logic: src/lib/theme.ts изменён baseline-снапшотом; login-page: «ТЕХНОЗРЕЛОСТЬ»/ГОСТ в login — файлы вне скоупа тикета); новый тест тикета 03 — pass
- Browser: PARTIAL — dev :3001 жив; визуальная проверка требует сессии (тестовых учёток нет); middleware/roles.ts/backend/landing не тронуты
