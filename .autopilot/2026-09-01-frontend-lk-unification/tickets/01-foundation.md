# 01 — P0 фундамент: типы, единый api-client, UI-база, дедуп констант

**Требования:** R33, G14, G30, R27, R32, R30, R31
**Blocked by:** —
**Зона:** `src/lib/`, `src/components/ui/`, `src/lib/api-client.ts`
**Волна:** 1
**Status:** ready

## Что должно заработать

Единый фундамент для всех остальных тасков: один источник типов Project/Registry, один api-client вместо 30 сырых fetch, 24 базовых UI-компонента на токенах --tz-*, унифицированные STATUS_LABELS/COLORS, фильтры в URL с дебаунсом. После таска любой следующий таск импортирует `lib/types` и `lib/api-client` и получает консистентные данные.

## Из брифа, дословно

> «Сформируй единую модель продукта: пользователь; организация; проект; участник проекта...»
> «категории проектов нужно унифицировать: чтобы был большой набор, но стандартизированных тем — это упростит работу с реестрами»
> «один проект может иметь разные теги одновременно. Например AI и медицина»
> «Не проектируй разные несвязанные интерфейсы для одинаковых сущностей»

## Разделы спецификации

Истории 2,7,14,19,40, Решения § Модули api-client/ui, §2.1, §2.5, §2.7, Швы §1,§2

## Критерии приёмки

- [ ] `src/lib/types.ts` экспортирует `ProjectCardOut`, `RegistryProjectOut`, `RegistryParams`, `OrganizationOut`, `DocumentOut` — 7 прежних дублей Project удалены, типы используются в 02-08
- [ ] `src/lib/api-client.ts` покрывает getProjects/getRegistry/getProject/togglePublish/archive/export/upload/download + notification/matching методы с Authorization и timeout 5s, сырых `fetch(${API_URL}/api/v1` вне него <3 вхождений
- [ ] `src/lib/filters.ts` + `useDebouncedValue` сериализует фильтры в URL (search, tags, ugt_min/max, status, region, budget) с дебаунсом 300ms, шаринг URL работает
- [ ] `src/components/ui/*` 24 компонента на `.tz-*` токенах (Button, Card, Badge, Modal, Drawer, Tabs, Search, Select, FilterPanel etc.) — без инлайн-hex
- [ ] `STATUS_LABELS` и `STATUS_COLORS` вынесены в `src/lib/status.ts` единый, тесты api-client + ui-shell зелёные 39/39, `npm run build` без ошибок при остановленном dev

## Технические заметки

- Удалить эксперта из ROLES? Нет, оставить в файле но пометить deprecated, фактический список 8 активных ролей фильтруется в shell. Лучше удалить константу полностью — согласовано G04.
- tags: массив строк 1-5, валидация на фронте, бэк пока category string — маппим tags[0] → category для совместимости
- Не трогать middleware.ts RBAC, только добавить типы
