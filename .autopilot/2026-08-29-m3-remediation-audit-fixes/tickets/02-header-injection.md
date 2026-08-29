# TICKET-02: Фильтр CRLF в заголовках (H-02b)

- **Связанная спецификация:** SPEC-01
- **Связанные проблемы:** H-02b (`files.py:148` `Content-Disposition`, `main.py:188` `X-Request-ID`)
- **Приоритет:** P0
- **Критичность:** High
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-01,03,04,05

## Проблема
`files.py:153` `fallback = raw.encode("ascii","replace")...replace('"',"_")` не фильтрует `\r\n` → `Content-Disposition: attachment; filename="a\r\nX: evil"` header injection. `main.py:188` `req_id.strip()[:64]` без валидации → `X-Request-ID: a\r\nX-Injected: 1` echo. Подтверждено код-ревью, ручной `curl -H $'X-Request-ID: a\r\nX:1'` → второй заголовок (внутри сети).

## Требуемый результат
- `Content-Disposition` без `\r\n"` — `fallback` → `re.sub(r'[\r\n\"]', "_", fallback)`.
- `X-Request-ID` echo только если `re.fullmatch(r"[A-Za-z0-9._-]{8,64}", req_id)`, иначе `uuid4().hex`.

## Объём работ
- `app/api/v1/files.py:148` добавить `import re`, `fallback = re.sub(r'[\r\n\"]', "_", fallback)`.
- `app/main.py:188` добавить `import re`, `if not re.fullmatch(...): req_id = uuid.uuid4().hex else: req_id = req_id` (уже есть `uuid`).
- `app/core/logging_config.py` не трогать (уже `request_id_ctx`).

## Не входит
Async Redis (TICKET-03), supply chain (TICKET-05).

## Затрагиваемые компоненты
- Файлы: `app/api/v1/files.py`, `app/main.py`
- Заголовки: `Content-Disposition`, `X-Request-ID`

## План реализации
1. `grep -n "Content-Disposition\|X-Request-ID" app -R`.
2. Добавить `re` фильтра, `fullmatch` валидацию.
3. `ruff/mypy`.
4. Ручной `curl -H $'X-Request-ID: a\r\nX:1' http://127.0.0.1:8000/api/v1/health -i | grep -c "X-Injected" ==0`.

## Пограничные случаи
- `file_name=""` → `fallback="file"` (уже).
- `X-Request-ID: short` (<8) → генерировать, не echo.
- `X-Request-ID` с `latin-1` вне `[A-Za-z0-9]` → генерировать.

## Тесты
- `test_download_crlf_escaped` — `file_name="a\r\nb\"c"` → header без `\r\n\"`.
- `test_request_id_crlf_generates` — `X-Request-ID: a\r\n` → response `X-Request-ID` 32 hex, не echo.

## Критерии приёмки
- [ ] `Content-Disposition` без `\r\n` на CRLF имени.
- [ ] `X-Request-ID` CRLF → генерируется 32 hex.
- [ ] `grep re.sub.*\\r\\n` в `files.py`, `fullmatch` в `main.py`.

## Команды проверки
- `.venv/bin/pytest tests/test_header_remediation.py -q`
- `.venv/bin/ruff check app && .venv/bin/mypy app`

## Риски
- Строгий `fullmatch` сломает легитимные `X-Request-ID` с другими символами (например, `:`) — но такие не используются (только `uuid4().hex` + `myid-123`), ок.
