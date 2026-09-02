# Спецификация: P2 — экспорт XLSX, сохранённые фильтры, LLM rerank, КТ 1-4

## Задача

После P1 унификации остался gap: реестры без экспорта, фильтры не сохраняются на сервере, matching работает script fallback без LLM, аудитор видит только КТ-1, шаблоны доков — мок. Пользователь (админ/аудитор) не может выгрузить реестр, сохранить подборку, получить LLM-объяснение.

## Решение

P2 закрывает 4 блока: XLSX экспорт для админа с теми же фильтрами, безлимит сохранённых фильтров на бэке, LLM rerank через `LLM_API_BASE` contour tuno с fallback script, КТ 1-4 Go/No-Go+чеки для аудитора, бэк-генерация шаблонов.

## Пользовательские истории

| # | Метка | История | Приёмка |
|---|-------|---------|---------|
| 1 | R01 | Как админ, я экспортирую реестр в XLSX с текущими фильтрами | кнопка Экспорт → XLSX скачивается, содержит те же строки что на экране |
| 2 | R02 | Как пользователь, я сохраняю фильтр без лимита и загружаю его позже | сохранить → список моих фильтров → применить |
| 3 | R03 | Как пользователь, я получаю LLM rerank топ≤5 с объяснением | при `LLM_API_KEY` есть — rerank + причины LLM, иначе script + бейдж fallback |
| 4 | R03.1 | При ошибке LLM я вижу fallback и могу Retry | ошибка → «LLM недоступен — показан script результат — Повторить» |
| 5 | R04 | Как аудитор, я выношу Go/No-Go по КТ 1-4 с чеками | на каждом КТ чек-лист + Go/No-Go, бейдж возврата |
| 6 | R05 | Как пользователь, я скачиваю шаблон дока с бэка | кнопка шаблон → GET /templates/{id} с сервера, не мок blob |
| 7 | R05.1 | Шаблон содержит актуальную версию из ГОСТа | version из бэка, не v1 хардкод |

## Решения по реализации

**Стек:** тот же + `exceljs`/`xlsx` для XLSX (`npm i exceljs` — спросить BLOCKED если нет, не ставить молча), `GET /projects/registry/export?format=xlsx&...` или фронт-генерит XLSX client-side из RegistryGrid данных (выбрать client-side чтобы не трогать бэк). Выбираю client-side `exceljs` — без бэк-изменений.

**Модули:**
- `features/registry/export` — `exportRegistryXlsx(params, data)` client-side
- `features/registry/saved-filters` — `useSavedFilters()` → `GET/POST/DELETE /filters/saved` (если бэк нет — localStorage fallback с `BLOCKED` пометкой)
- `features/matching/llm` — `rerankWithLlm(candidates, query)` → `POST ${LLM_API_BASE}/v1/chat/completions` contour tuno, иначе script
- `features/project/KtPanel` — расширение `ChecklistPanel` до КТ 1-4 per ControlPoint

**API:**
- `GET /filters/saved`, `POST /filters/saved`, `DELETE /filters/saved/{id}` — новый, если нет — fallback localStorage + пометка `BLOCKED: filters/saved`
- `LLM_API_BASE` уже в config, `LLM_API_KEY` имя в .env.example
- `GET /templates/{id}` — уже есть `document_generator`, проверить

**Безопасность:** экспорт только cntr_admin (cntr_manager read-only если решим), LLM без ПДн как в P1, XLSX без формул инъекций (escape `=`).

## Границы и швы

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `registry/export` | XLSX экспорт | `exportXlsx(params)` | exceljs, escape |
| `registry/saved-filters` | сохранённые фильтры | `useSavedFilters()` | бэк vs localStorage fallback |
| `matching/llm` | rerank | `rerank(cands)` | LLM tuno, fallback |
| `project/kt` | КТ 1-4 | `KtPanel({projectId})` | Go/No-Go |

Швы: `registry/export` шов, `matching/llm` шов.

## Вне рамок

| Требование | Почему |
|---|---|
| R06 аналитика расширение | P3, базового хватает |
| CSV отдельно | делаем сразу XLSX как выбрано |

## Открытые места

- `POST /filters/saved` может не существовать — fallback localStorage, пометка BLOCKED, бэк-тикет отдельно

## Покрытие

| R | Истории |
|---|---|
| R01 | 1 |
| R02 | 2 |
| R03 | 3,4 |
| R04 | 5 |
| R05 | 6,7 |
