# 10 — CODE-01: счётчик подавленных исключений

**Требование:** R23. **После:** T09 и зелёного backend baseline. **Зона:** `technozrelost-backend/app/services/metrics.py`, явно подавляющие исключения в `auth_throttle.py`, `rag.py`, `file_storage.py`, `matching.py`, `main.py`, `core/deps.py`, `api/v1/nioktr.py`, `api/v1/metrics.py`, плюс observability tests.

## Контекст

Finding CODE-01 описывает fallback-пути, где широкое исключение поглощается и сбой выглядит штатным. До изменения подтвердить каждый кандидат чтением тела `except`: включать только ветви, которые возвращают дефолт, переключаются на fallback, делают `pass`/`continue` или иным образом не передают ошибку вызывающему коду. Не считать подавлением ветви, которые логируют stack trace и завершают запрос ошибкой, переводят исключение в HTTP-ошибку или повторно выбрасывают его.

## Изменение

- Добавить в существующий Prometheus collector монотонный thread-safe counter `technozrelost_suppressed_exceptions_total` с единственной фиксированной меткой `module`.
- Значения `module` — только статический allowlist имён из списка выше; не передавать exception text, path, tenant, user/project data или произвольные строки.
- Увеличивать счётчик в каждом подтверждённом suppress/fallback месте CODE-01. Сам учёт best-effort и не должен менять текущую семантику fallback или ломать scrape.
- Расширить существующие observability tests: counter появляется в exposition, накапливается при событии, очищается `reset()`, label bounded и escaped; добавить regression на representative swallowed fallback.
- Не менять продуктовую семантику, текст ошибок, логирование содержимого, внешние API, DB, dependencies или production.

## Приёмка

- Все suppress/fallback sites в перечисленных finding-модулях учтены; исключения, которые распространяются вызывающему коду, не маркируются подавленными.
- Label cardinality ограничена статическим набором модулей; в метрики не попадают данные запроса/исключения.
- Regression tests, Ruff, mypy и связанные backend tests зелёные; затем оркестратор запускает полный backend suite.
- Изменять только перечисленные product files/tests и отдельные evidence/Status/Autopilot записи. Не коммитить и не пушить до независимого ревью оркестратором.
