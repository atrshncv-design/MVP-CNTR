# T-013 — Authentication and five-step registration

Status: done
Blocked by: T-001 (токены), T-002 (shell); mock-сессия — T-003

## Цель
Вход, пятишаговая регистрация (1 пользователь → 2 организация → 3 роль/назначение → 4 подтверждение и безопасность → 5 ожидание/одобрение), восстановление пароля, состояния pending/rejected/clarification. В P0 — mock-авторизация (демо-роли), контракт интерфейса готов к реальному NextAuth на интеграции.

## Зависимости
T-001, T-002, T-003 (переключатель ролей).

## Изменяемые файлы / области
- `platform/src/app/(auth)/login/page.tsx` — состояния: initial, validation error, invalid credentials, locked, success.
- `platform/src/app/(auth)/register/page.tsx` + `organization/page.tsx` + `role/page.tsx` + `confirm/page.tsx` + `pending/page.tsx` — 5 шагов: прогресс и текущий шаг, сохранение ввода при навигации назад, field-level валидация с объяснением, различие данных пользователя/организации/роли, «что будет после подачи», восстановление после отклонения/неполной заявки.
- `platform/src/app/(auth)/forgot-password/page.tsx`, `reset-password/page.tsx`.
- `platform/src/lib/session.ts` — mock-сессия: демо-аккаунты (demo.gk@example.com, demo.rd@example.com, demo.manager@example.com, demo.admin@example.com, demo.investor@example.com), роль, персист в localStorage; интерфейс, зеркалящий будущий NextAuth (signIn/signOut/getSession).
- `platform/src/app/(app)/login-required` поведение: доступ без сессии → редирект на `/login`.

## Сценарий пользователя
Посетитель регистрируется: шаг 1 данные → шаг 2 организация → шаг 3 роль → шаг 4 подтверждение → шаг 5 «Заявка на проверку отправлена» (или отклонена с причиной/запрошены уточнения). Вход с неверными данными → понятная ошибка. Роли ЦНТР (cntr_*) недоступны для самовыбора (назначаются администратором — зеркало бэкенда).

## Acceptance criteria
- [ ] Пользователь знает, что будет после подачи.
- [ ] Ввод переживает навигацию по шагам.
- [ ] Роль и организация — отдельные концепции.
- [ ] Ошибки и pending НЕ выглядят как успешный доступ.
- [ ] Роли ЦНТР не выбираются при регистрации.
- [ ] Mock-сессия: вход под демо-ролью → соответствующий `/app` или `/operations`; выход → публичный сайт.

## Состояния
initial, validation, duplicate organization, saved draft, submitted, pending, rejected (с причиной), clarification requested; login: locked, invalid credentials.

## Desktop / mobile
Desktop: auth-shell (hero + форма, Design.md-эстетика без пилюль). Mobile: форма на всю ширину, шаги не теряют ввод, тач-цели ≥44px.

## Данные и adapter requirements
Регистрация пишет в mock-хранилище (localStorage/IndexedDB); интерфейс `AuthAdapter` (mock сейчас, NextAuth на интеграции) — замена без переписывания страниц. Демо-аккаунты НЕ содержат реальных секретов.

## Критерии визуальной проверки
Браузер: полный 5-шаговый флоу с возвратом назад (ввод сохранён), ошибки валидации, pending-состояние, вход под каждой демо-ролью, 3 темы, mobile, скриншоты. lint/tsc/build зелёные.
