# Границы P2

> Скопировано из spec.md

## Запуск и тесты

- `cd technozrelost-frontend && npm run lint && npm test && npm run build`
- Не трогать `technozrelost-backend` без BLOCKED, LLM via `LLM_API_BASE` имя

## Границы

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `registry/export` | XLSX | `exportXlsx` | exceljs |
| `registry/saved-filters` | фильтры | `useSavedFilters` | бэк/localStorage |
| `matching/llm` | rerank | `rerank` | tuno |
| `project/kt` | КТ 1-4 | `KtPanel` | Go/No-Go |
