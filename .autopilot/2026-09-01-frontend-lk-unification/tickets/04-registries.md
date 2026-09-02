# 04 — Реестры единый стандарт (карточки, фильтры, realtime, избранное)

**Требования:** R06, R20-R22, G14, G24-G26, G33, G42, G45-G47, G49, G55-G56, R21, G38
**Blocked by:** 01
**Зона:** `src/features/registry/`, `src/app/dashboard/projects/`, `src/app/dashboard/technologies/`, `src/app/dashboard/organizations/`, `src/app/dashboard/nioktr/`, `src/app/dashboard/executors/`
**Волна:** 2
**Status:** ready

## Что должно заработать

Единый стандарт реестров: только карточки (без таблицы), расширенные фильтры (поиск + теги-категории 30+ + УГТ min/max + статус + регион + бюджет), пагинация 20 + «Показать ещё» keyset, сортировка по дате ↓ default, фильтры в URL (шаринг), избранное звёздочка localStorage + фильтр «Избранное», realtime обновление без ручного refresh, скелетон + empty с CTA + ошибка с Retry, мобилка 1 колонка + drawer фильтров, бюджет всем виден, экспорт пока без.

## Из брифа, дословно

> «Реестр проектов; реестр организаций; реестр технологий... Какие колонки нужны; какие фильтры обязательны; нужна ли пагинация; нужен ли полнотекстовый поиск; нужны ли сохранённые фильтры»
> «проекты составляют реестр технологий»
> «один проект может иметь разные теги одновременно»

## Разделы спецификации

Истории 18-26,35, Решения § registry, Шов 3

## Критерии приёмки

- [ ] `features/registry/RegistryGrid` + `FilterBar` + `useRegistry` + `useRealtime` используются всеми 4 реестрами (projects/technologies/organizations/nioktr/executors). Удалены дубли `STATUS_LABELS` в каждой странице, используются `lib/status`. `useRegistry` ходит через `api-client.getRegistry` с `RegistryParams` (search, tags[], ugt_min/max, status, region, budget), дебаунс 300ms via `filters.ts`, пагинация `limit=20 after_id` keyset, кнопка «Показать ещё»
- [ ] Фильтры сериализуются в URL (`?search=&tags=AI,medicina&ugt_min=7&status=active`), шаринг работает, при перезагрузке восстанавливаются. Категории → теги: выбор 1-5 из справочника 30+ (чипы), поиск по тегам
- [ ] Избранное: `FavoriteStar` в карточке, хранит id в localStorage `tz:favorites:{registry}`, фильтр «Избранное» показывает только отмеченные. Тест localStorage
- [ ] Состояния: loading → skeleton 6 карточек, empty → `tz-empty` с иконкой + «Пока нет проектов — создайте заявку» CTA, error → сообщение + кнопка «Повторить», forbidden → 403 страница, partial data — карточки с «—». Тест ui-shell
- [ ] Realtime: реестр подписывается на SSE ` /notifications/stream` или WS, при `is_public` изменении карточка обновляется без ручного рефреша. Fallback polling если SSE недоступен. Проверено: публикация проекта в другой вкладке появляется в реестре <5с
- [ ] Проекты = технологии: `technologies` таб берёт `projects/registry?ugt_min=7`, не `GET /technologies`; удалён мок `CATEGORIES=["AI/ML","НИОКТР"]`, бюджет всем виден, сортировка по дате ↓, дата 31.03.2027 + тултип «2 дня назад», мобилка 1 колонка + drawer фильтров, лимит 20

## Технические заметки

- Зона registry — не лезть в project/dashboard/matching
- Бэк `projects/registry` игнорирует `status` — фильтр status делаем клиентским до бэк-фикса, пометить TODO с ссылкой на issue
- Не делать экспорт CSV (G42), сохранённые серверные фильтры — P2
- Тест: `getRegistry` с тегами → URL содержит tags, звёздочка → localStorage
