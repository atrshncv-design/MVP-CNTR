# 02 — Унифицированный shell 8 ЛК (топбар+табы)

**Требования:** R02, R03, R15, G01-G12, R24, R33, G05, G32, G51
**Blocked by:** 01
**Зона:** `src/features/dashboard/`, `src/app/dashboard/`
**Волна:** 2
**Status:** ready

## Что должно заработать

Один `RoleDashboardShell` рендерит 8 кабинетов (gk_customer, rd_executor, scientific_org→клон R&D, serial_manufacturer, regulating_organization, auditor, investor, cntr_admin, cntr_manager — без эксперта). Общий топбар 72px тёмный + табы (`Проекты / Новая заявка / Реестр технологий / Каталог исполнителей` по роли), hero + 4 stats + список проектов где участвует (не все организации) + CTA «Создать заявку» + «Вступить по TZ-XXXXXX» + избранное. Каждая ролевая страница `page.tsx` становится тонкой обёрткой 15 строк.

## Из брифа, дословно

> «Проверь и опиши frontend для всех ролей платформы: заказчик-госкомпания; R&D-исполнитель; научная организация; серийный производитель; регулятор; аудитор; инвестор; администратор; менеджер ЦНТР»
> «У человека должна быть стабильная роль в профиле, но роль в проекте может меняться — зависит от роли в ссылке-приглашении»
> «Проекты показываются у всех организаций в которых он состоит (но только те проекты, в которых он сам участвует)»

## Разделы спецификации

Истории 1-7,12, Решения § dashboard-shell, §2.4

## Критерии приёмки

- [ ] `src/features/dashboard/RoleDashboardShell.tsx` принимает `role: RoleSlug` и рендерит hero («Добро пожаловать, {name}»), `AssessUgTCard`, 4 stat-cards, список `ЦНТР-{id}` через `api-client.getProjects`, CTA «Создать заявку» → `/dashboard/gk_customer/projects/new`, «Вступить по TZ-XXXXXX» → `JoinProjectForm` с валидацией `TZ-XXXXXX`
- [ ] 8 файлов `dashboard/{role}/page.tsx` сведены к `return <RoleDashboardShell role="..."/>`; дублирование rd_executor/scientific_org устранено, scientific_org использует тот же shell с пропсом `role="scientific_org"` и иконкой GraduationCap
- [ ] Список проектов фильтруется по membership (GET /projects уже фильтрует), не по organization.projects_count; проверено: пользователь в 2 орг по 100 проектов видит 8 где участвует
- [ ] `dashboard/gk_customer/projects` (показывает UgtScalePageClient заглушку) удалён/редиректит на `/dashboard/projects`; маршрут `/gk_customer/projects/new` оставлен с алиасом `/assessment/new` + редирект, тесты routes-matrix обновлены
- [ ] `ROLES` без эксперта (8 записей), `ROUTE_ALLOWED_ROLES` fail-closed сохранён, `getVisibleMenuItems` фильтрует по allowedRolesFor, `npm test routes-matrix` зелёный, `middleware` не ломается, 403 на чужой кабинет
- [ ] Кнопки в шапке (не Cmd+K, не FAB), избранное localStorage звёздочка в списке проектов, только светлая палитра, даты 31.03.2027 + тултип

## Технические заметки

- Волна 2 параллельно с 03/04/05/07 — зона только `features/dashboard` и `app/dashboard/{role}` (не лезть в project/registry)
- Использовать `lib/types` и `api-client` из 01, не сырой fetch
- Тест: логин под каждой из 8 ролей → свой ЛК открывается без 403, чужой → 403
