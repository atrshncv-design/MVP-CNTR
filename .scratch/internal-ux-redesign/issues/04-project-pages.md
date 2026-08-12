# 04 — Проекты и подробная карточка
**Status:** ready-for-review
**Blocked by:** 03
- Списки проектов с таблицей/карточками и сохранением фильтров.
- Отдельная страница проекта: сводка → статус/УГТ → документы → команда → история → аналитика.
- Радар только боковым блоком подробной страницы.
- Никаких наложений и переполнения текста.

## Что сделано
- Список проектов `/dashboard/projects` переделан: серверная страница (честные
  error/empty состояния сохранены) + клиентский `ProjectsExplorer`
  (src/app/dashboard/projects/projects-explorer.tsx):
  - переключатель «Карточки / Таблица» (localStorage `tz-projects-view`),
    таблица — колонки Название/Категория/УГТ/Статус/Обновлён, горизонтальный
    скролл в контейнере с `tabIndex` для клавиатуры;
  - поиск по названию, фильтры «Статус» и «УГТ», сортировка, пагинация;
  - фильтры сохраняются в URL-параметрах (`?view&q&status&ugt&sort&page`,
    URL приоритетнее) и дублируются в localStorage `tz-projects-filters`;
  - компактные карточки БЕЗ радаров: название, категория, УГТ-бейдж, статус,
    метаданные; честное пустое состояние «Ничего не найдено» + сброс фильтров.
- Подробная страница `/dashboard/project/[id]`: порядок блоков СТРОГО
  сводка → статус/УГТ → документы → команда → история → аналитика;
  `ProjectRadar` вынесен из шапки и используется ТОЛЬКО боковым блоком
  (aside, «Радар готовности»); убраны дубли-блоки из сайдбара (УГТ-уровень,
  КТ-1, Команда, Общий прогресс — их данные живут в основной колонке);
  добавлены `useBreadcrumb` с названием проекта и блоку «Сводка» (категория,
  id, даты создания/обновления — поля подтверждены по openapi ProjectOut).
- `src/lib/api-client.ts`: добавлены типы карточки проекта
  (`ProjectDetail`, `ProjectQuestionnaireResult`, `ProjectControlPoint`,
  `ProjectDocument`, `ProjectVerificationDocument`, `ProjectMember`,
  `ProjectAuditEntry`) — аддитивно, существующие export не тронуты
  (страница импортирует `ProjectDetail` через `import type`).
- gk_customer/projects: дублей списка проектов нет (это UgtScale/wizard),
  файлы не менялись.
- tests/ui-shell.test.mjs: добавлены структурные тесты тикета 04
  (переключатель вида, localStorage-ключи, колонки таблицы, пагинация,
  порядок блоков карточки, радар только внутри `<aside>`).

## Files
- src/app/dashboard/projects/page.tsx (переделан)
- src/app/dashboard/projects/projects-explorer.tsx (новый)
- src/app/dashboard/project/[id]/page.tsx (переделан)
- src/lib/api-client.ts (добавлены типы)
- tests/ui-shell.test.mjs (добавлены тесты)

## Checks
- npm run lint — 0 errors (8 warnings — pre-existing в landing/*, не мои файлы)
- npx tsc --noEmit — clean
- npm test — 12 pass / 2 fail (fail — пре-существующие baseline:
  tests/theme-logic.test.mjs и login; не чинились)
- Dev-сервер :3001: /dashboard/projects и /dashboard/project/1 → 307 на login
  (auth-граница работает, 500 нет); /login → 200. Браузерная проверка PARTIAL
  (без учётки). npm run build не запускался (тикет 08).
