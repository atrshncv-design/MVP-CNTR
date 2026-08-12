# 05 — Реестры
**Status:** ready-for-review
**Blocked by:** 03
- Реестры проектов, технологий, организаций и специалистов.
- Переключатель таблица/карточки, поиск, фильтры, сортировка, пагинация.
- Компактная карточка без радара; подробности — отдельный маршрут.

Files:
- src/lib/api-client.ts (дополнен: RegistryProject, NioktrCard, OrganizationSummary/Detail, ExecutorSummary, getRegistryProjects/getNioktr/getOrganizations/getExecutors — типы по реальным ответам API)
- src/app/dashboard/technologies/page.tsx (переработан: вкладки Проекты/Технологии из registry API, таблица/карточки, поиск, фильтры по категории и УГТ-диапазону, 8 вариантов сортировки, пагинация с многоточиями, сохранение вида/фильтров в localStorage)
- src/app/dashboard/nioktr/page.tsx (переработан: таблица/карточки, поиск, фильтры по типам/программам/годам, сортировка, пагинация, сохранение)
- src/app/dashboard/nioktr/[registration_number]/page.tsx (приведён к единому виду, breadcrumb)
- src/app/dashboard/organizations/page.tsx (переработан: таблица/карточки, поиск, фильтры по типу/компетенциям, сортировка, пагинация, сохранение)
- src/app/dashboard/organizations/[ogrn]/page.tsx (приведён к единому виду, breadcrumb, список НИОКТР организации)
- src/app/dashboard/executors/page.tsx (переработан: таблица/карточки, поиск, фильтры, сортировка, пагинация; честное пустое состояние без mock-данных)

Checks:
- npm run lint — 0 errors, 8 pre-existing warnings (landing/*)
- npx tsc --noEmit — clean (exit 0)
- npm test — 15/17 pass; 2 fail — pre-existing на baseline c4f0794 (theme-logic: src/lib/theme.ts; login-page: «ТЕХНОЗРЕЛОСТЬ» в login) — файлы вне скоупа
- Browser: PARTIAL (визуальная проверка требует сессии)
- RBAC/middleware/backend/landing не тронуты; mock-success нет (реальные API-данные)
