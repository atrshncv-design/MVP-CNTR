# 07 — Уведомления + сессия модалка + верификация профилей

**Требования:** R24, G43, G52, G54, G41, G55, R26, G38-G39
**Blocked by:** 01
**Зона:** `src/features/notifications/`, `src/components/notification-bell.tsx`, `src/app/dashboard/notifications/`, `src/components/profile-verification-queue.tsx`
**Волна:** 2
**Status:** ready

## Что должно заработать

Колокольчик в топбаре с SSE + страница `/dashboard/notifications` с фильтрами прочитано/непрочитано, модалка «Сессия истекла — войдите заново» без потери черновика (localStorage), верификация организаций/исполнителей менеджером+админом в очереди, базовый focus-visible, скелетон+retry для уведомлений.

## Из брифа, дословно

> «Модалка + черновик» (сессия)
> «Скелетон + retry»
> «Менеджер + админ верификация»
> «Базовый focus»

## Разделы спецификации

Истории 32,38,43,46, Решения § notifications, §2.6

## Критерии приёмки

- [ ] `NotificationBell` в `dashboard/layout` подписывается на `GET /notifications/stream` SSE (fallback polling 30с), бейдж непрочитанных, клик → дропдаун последние 10 с mark read, realtime при публикации проекта (из 04) и matching заявке (из 05)
- [ ] Страница `/dashboard/notifications` (ALL_ROLES) — список с фильтрами «Все/Непрочитано», `GET /notifications` + `POST /{id}/read`, empty «Нет уведомлений», скелетон, ошибка Retry, дата 31.03.2027 + тултип
- [ ] Модалка сессии: при 401/RefreshAccessTokenError или `allowedRolesFor` 403 после потери прав — модалка «Сессия истекла — войдите заново» поверх страницы, черновик карточки сохранён в localStorage `tz:draft:{projectId}`, после логина восстанавливается. Не редиректит сразу на /login с потерей данных. Тест: 401 → модалка, localStorage содержит draft
- [ ] `ProfileVerificationQueue` (менеджер+админ) рендерит очередь `GET /manager/profiles` и `GET /manager/orgs`, кнопки Подтвердить/Отклонить с причиной, доступна только cntr_manager/cntr_admin (403 иначе)
- [ ] Базовый focus-visible кольцо 2px --tz-accent offset 2px сохранено, без WCAG AA аудита, тесты security-headers зелёные

## Технические заметки

- Зона notifications — не лезть в registry/project, но колокольчик в layout
- SSE reconnection с backoff, не спамить
- Использовать api-client для notifications
