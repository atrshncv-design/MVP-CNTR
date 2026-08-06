# T-006 — Public discovery and registries

Status: done
Blocked by: T-001, T-004 (данные), T-002 (shell), T-005 (состояния)

## Цель
Публичный discovery: `/find`, реестры `/technologies`, `/requests`, `/partners`, `/research` (+ детальные `/research/:id`, `/technology/:id` — карточка-превью, полный dossier — T-007), глобальный поиск, специализированные фильтры, URL-персист состояния поиска.

## Зависимости
T-002 (shell), T-004 (адаптер+фикстуры), T-005 (состояния).

## Изменяемые файлы / области
- `platform/src/app/(public)/find/page.tsx` — задача-first хаб discovery (Design.md §12.2).
- `platform/src/app/(public)/technologies/page.tsx`, `requests/page.tsx`, `partners/page.tsx`, `research/page.tsx`, `research/[id]/page.tsx`.
- `platform/src/components/registry/` — `search-toolbar.tsx` (поиск+фильтры+сортировка), `filter-sheet.tsx` (мобильный bottom-sheet), `result-list.tsx` / `result-table.tsx` (переключение видов), `result-card.tsx` (карточка: что это, почему важно, состояние, следующее действие, provenance), `result-count.tsx` (только по реальным данным).
- URL-состояние: `?search=&industry=&sort=&page=` в searchParams, без потери при навигации назад.

## Сценарий пользователя
Посетитель ищет «искусственный интеллект» → видит реальные НИОКТР-записи с источником; фильтрует по отрасли/году; открывает детальную карточку НИОКТР. Раздел «Технологии» без реальных записей → «Пока нет опубликованных технологий по этому фильтру» + действие «Представить технологию». Запросы/партнёры — «Раздел готов к наполнению» или пустые состояния.

## Acceptance criteria
- [ ] Поиск и фильтры работают по реальным записям (НИОКТР: ключевые слова, типы, исполнитель/заказчик, is_ai_area/is_ai_usage, год).
- [ ] No-result и unavailable-data состояния спроектированы и объясняют следующий шаг.
- [ ] Каждый результат: статус публикации/проверки, provenance (источник, дата импорта), действие.
- [ ] Мобильные фильтры — bottom-sheet, карточки результатов читаемы.
- [ ] Фикстуры (isFixture) НЕ появляются в публичных реестрах.
- [ ] Счётчики результатов только при реальных данных.

## Состояния
loading (скелеты), empty, partial (карточки с пропущенными полями), error (retry), success. Реестр технологий — публичные «нет записей».

## Desktop / mobile
Desktop: search-first макет, таблица/список. Mobile: стек-карточки, фильтры в bottom-sheet, поиск доступен сверху.

## Данные и adapter requirements
`listResearch(ListQuery)` (реальные 400 карточек), `listTechnologies` (пусто), `listCustomerRequests` (пусто), `listOrganizations` (справочник из executor/customer НИОКТР — реальный, дедуплицированный). URL-параметры → ListQuery.

## Критерии визуальной проверки
Браузер: `/research` с реальными записями, фильтр «AI», пустой результат, ошибка (dev-триггер), 3 темы, mobile 390px, скриншоты. lint/tsc/build зелёные.
