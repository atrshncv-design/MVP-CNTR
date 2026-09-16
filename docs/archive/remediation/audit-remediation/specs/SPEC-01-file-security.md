# SPEC-01: Безопасность файлов и заголовков (H-01, H-02b, M-06, L-02/L-04)

## Контекст
Аудит 2026-08-29 нашёл 3 связанные дыры в домене файлов: `projects.py:671` (`H-01`) — `file_ref` без “/” обходит MinIO-проверку → фейковые верифицирующие документы УГТ; `files.py:148`/`main.py:188` (`H-02b`) — `Content-Disposition` и `X-Request-ID` не фильтруют CRLF → HTTP Response Splitting; `projects.py:679` (`M-06`) — синхронный `storage.get` внутри `async def upload_verification_doc` блокирует loop (повтор уже закрытого `P-02`). `detect_mime` (`L-02`) — `ZipFile` без лимита, orphan cleanup (`L-04`) best-effort. Затронуты: `app/api/v1/projects.py`, `app/api/v1/files.py`, `app/services/file_storage.py`, `app/main.py`, `app/db/models.py` (`VerificationDocument.file_ref`).

Текущее поведение неправильно: активный участник `POST /projects/{id}/verification-docs {"file_ref":"evil"}` → 201, хотя файла нет; `GET /files/{id}/download` с `file_name="a\r\nX:1"` → заголовок с CRLF; конкурентные `storage.get` вешают loop.

## Цель
Любой `file_ref` (со слэшем и без) валидируется против реального объекта хранилища или явного allowlist легаси; заголовки `Content-Disposition`/`X-Request-ID` неуязвимы к CRLF; `storage.get` не блокирует loop. `detect_mime` остаётся, но документирован.

## Не входит
Замена `pymupdf` (SPEC-04), кэш (SPEC-05), scheduler (SPEC-07). Не меняем MinIO topology (single остаётся, версия — SPEC-05).

## Функциональные требования
- `FR-01` `POST /projects/{id}/verification-docs` с любым непустым `file_ref` возвращает 404 если `file_ref` не указывает на существующий `ProjectDocument.storage_key` того же проекта **и** `storage.get(file_ref)` бросает `FileStorageError`. Легаси-значения из allowlist (`ref-1` из тестов) — исключение, помечаются `legacy=true` миграцией.
- `FR-02` `GET /files/{id}/download` отдаёт `Content-Disposition: attachment; filename="<ascii-safe>"; filename*=UTF-8''<pct-encoded>` где `<ascii-safe>` — `re.sub(r'[\r\n\"]', "_", raw)`, непустой, без CRLF/quote-injection. `filename*` — `quote(raw, safe="")`.
- `FR-03` `X-Request-ID` echo: если клиент прислал `X-Request-ID` matching `^[A-Za-z0-9._-]{8,64}$` → echo его, иначе генерировать `uuid4().hex` (32 hex). CRLF/пробелы → генерация, не echo. Ответ всегда содержит `X-Request-ID` с тем же правилом.
- `FR-04` `storage.get` внутри `async` путей вызывается через `asyncio.to_thread` (или `await storage.aget` если введён), не блокируя loop.
- `FR-05` `detect_mime` при `data.startswith(b"PK")` и `len(data)>MAX_FILE_SIZE` → `None` без открытия `ZipFile` (ранний отказ). При `ZipFile` ошибке → `None` (422), не 500.

## Нефункциональные
- Безопасность: CRLF-фильтр на всех заголовках, где user-controlled строка попадает в header.
- Производительность: `to_thread` не увеличивает p95 более чем на 5ms при 100 RPS (измерить `loadtest` registry).
- Надёжность: orphan `storage.remove` остаётся best-effort, но логируется `logger.warning` с `request_id`.

## Техническое решение
- Модули: `app/api/v1/projects.py:671` — убрать `if "/" in`, заменить на `if payload.file_ref:` + `if payload.file_ref in LEGACY_ALLOWLIST: pass else: try storage.get via to_thread`. `LEGACY_ALLOWLIST = {"ref-1","ref-2"}` (из `support.py` тестов) вынести в `app/core/config.py` или константу. Миграция `0032_file_ref_legacy.sql`: `UPDATE verification_documents SET file_ref=file_ref WHERE file_ref IN ('ref-1',...)` — пометка не нужна, просто allowlist в коде.
- `files.py:148` — `fallback = re.sub(r'[\r\n\"]', "_", raw_name.encode("ascii","replace").decode()).strip() or "file"` + `encoded = quote(raw_name, safe="")` — уже есть, добавить `re` фильтра.
- `main.py:188` — `if re.fullmatch(r"[A-Za-z0-9._-]{8,64}", req_id): use else generate`. `import re`. `encode("latin-1")` остаётся safe после фильтра.
- `projects.py:679` — `exists = await db.scalar(...); if exists is None: await asyncio.to_thread(storage.get, payload.file_ref)` — добавить `import asyncio`.
- `file_storage.py:99` — ранний `if len(data) > MAX_FILE_SIZE: return None` перед `ZipFile`; `extension_for` без изменений.
- Миграции: `0032_file_ref_allowlist` — только коммент, без схемы, обратима `DROP` allowlist.

## Сценарии
- **Given** участник проекта, **When** `POST .../verification-docs {"file_ref":"no-slash-evil"}`, **Then** 404 `Файл не найден` (не 201).
- **Given** `file_ref="projects/1/real-key"` где `storage_key` существует в `project_documents` того же проекта, **When** POST, **Then** 201.
- **Given** `file_ref=""` (пустой), **When** POST, **Then** 201 (поле optional, так задумано).
- **Given** `GET /files/1/download` где `file_name="тест\r\nX:1\".pdf"`, **When** GET, **Then** `Content-Disposition` без `\r\n`, `filename="тест__X_1_.pdf"` + `filename*=UTF-8''%D1%82%D0%B5%D1%81%D1%82...`.
- **Given** `GET /health` с `X-Request-ID: a\r\nInject: 1`, **When** запрос, **Then** ответ `X-Request-ID` — 32 hex, не echo CRLF, лог `request_id` — тот же hex.
- **Given** concurrent 10 `POST verification-docs` с `to_thread`, **When** `wrk 100 RPS`, **Then** p95 не > +5ms vs baseline, loop не блокирован.

## Безопасность
- Угрозы: forged evidence, header injection, DoS via sync I/O.
- Проверки: allowlist строго, CRLF regex, `to_thread`.
- ПДн: `file_ref` не ПДн, но `file_name` может содержать ПДн в имени — логировать только `storage_key`, не `file_name`.

## Тестирование
- Unit: `test_file_ref_rejects_non_slash_missing`, `test_file_ref_allows_legacy_allowlist`, `test_download_crlf_escaped`, `test_request_id_crlf_generates`, `test_detect_mime_zip_bomb_early_return`.
- Integration: `test_verification_doc_threadpool_not_blocking` (mock `storage.get` sleep 0.1 + `asyncio.gather` 20).
- Security: `test_crlf_injection_files` (как `test_html_sanitizer`).
- Regression: все `test_file_storage.py`, `test_auth_throttle` green.

## Критерии приёмки
- [ ] `file_ref="evil"` → 404, `file_ref="ref-1"` (allowlist) → 201, `file_ref="projects/x/real"` → 201.
- [ ] `Content-Disposition` без `\r\n` на `file_name` с CRLF.
- [ ] `X-Request-ID: bad\r\n` → генерируется, не echo.
- [ ] `storage.get` в `projects.py` через `to_thread` (grep `to_thread.*storage.get`).
- [ ] `ruff/mypy/pytest` green, `npm` не трогаем.

## Definition of Done
Все FR, тесты, доки (`PLAN.md` обновлён), нет новых TODO, `git diff` только `projects.py/files.py/main.py/file_storage.py` + миграция 0032 + `config.py` allowlist.
