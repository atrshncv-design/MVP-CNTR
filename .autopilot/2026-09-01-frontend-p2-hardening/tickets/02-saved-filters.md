# 02 — Сохранённые фильтры без лимита

**Требования:** R02
**Blocked by:** —
**Зона:** `src/features/registry/saved-filters/`
**Волна:** 1
**Status:** ready

## Что должно заработать
Пользователь сохраняет фильтр без лимита, видит список своих, применяет/удаляет. `GET/POST/DELETE /filters/saved` если бэк есть, иначе localStorage fallback + пометка BLOCKED.

## Из брифа
> «Без лимита»

## Разделы спецификации
Истории 2, Шов —

## Критерии приёмки
- [ ] Кнопка «Сохранить фильтр» → ввод имени → список «Мои фильтры» → клик применяет, крестик удаляет, без лимита
- [ ] Пробует `api-client` `getSavedFilters/saveFilter/deleteFilter`, если 404 → fallback localStorage `tz:saved-filters`, помечает BLOCKED в отчёте
- [ ] Тест saved-filters mock
