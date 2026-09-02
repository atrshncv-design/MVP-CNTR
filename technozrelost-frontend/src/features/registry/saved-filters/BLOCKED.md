# BLOCKED: filters/saved

- **Эндпоинт:** `GET/POST/DELETE /filters/saved` (ожидалось в `technozrelost-backend/app/api/v1/*`)
- **Статус:** отсутствует в бэкенде (нет модели/роутера, grep по `technozrelost-backend/app` не находит `filters`)
- **Решение:** фронт пробует `api-client` (`getSavedFilters/saveFilter/deleteFilter` → `/api/v1/filters/saved`), при `404`/`405`/`501` — fallback `localStorage` ключ `tz:saved-filters` без лимита
- **Пометка в коде:** `BLOCKED_REASON = "BLOCKED: filters/saved — backend endpoint not available, localStorage fallback tz:saved-filters"` (`storage.ts:8`, `useSavedFilters.ts:62`, `SavedFilters.tsx: blockedReason`)
- **Рантайм-маркер:** `window.__TZ_BLOCKED_filters_saved = true` + `console.warn(BLOCKED_REASON)` при переходе в fallback, UI бейдж `local` + текст причины в `SavedFilters`
- **Без лимита:** `addLocalSavedFilter` — `[...list, entry]` без `slice`/truncate, тест `saved-filters.test.mjs` проверяет 15 без обрезки
- **Бэк-тикет отдельно:** нужен `technozrelost-backend/app/api/v1/filters.py` + модель `SavedFilter` (user_id, name, filters JSONB, created_at) + миграция
