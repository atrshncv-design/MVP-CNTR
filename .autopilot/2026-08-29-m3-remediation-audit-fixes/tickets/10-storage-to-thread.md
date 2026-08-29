# TICKET-10: storage.get to_thread (M-06)

- **Спека:** SPEC-01
- **Проблемы:** M-06 (`projects.py:679` sync `storage.get` в async)
- **Приоритет:** P0
- **Критичность:** Medium
- **Сложность:** S
- **Зависимости:** TICKET-01 (file_ref logic)
- **Можно параллельно с:** TICKET-02,03,04

## Проблема
`projects.py:679` `storage.get(payload.file_ref)` — синхронный MinIO `get_object` ( blocking `socket` ) внутри `async def upload_verification_doc` → блокировка loop, повтор `P-02` уже закрытого для `aput`.

## Требуемый результат
`storage.get` внутри async путей через `await asyncio.to_thread(storage.get, file_ref)`.

## Объём работ
- `app/api/v1/projects.py:679` заменить `storage.get(payload.file_ref)` на `await asyncio.to_thread(storage.get, payload.file_ref)` → добавить `import asyncio` если нет.
- Аналогично проверить `storage.get` в других `async` — `files.py:149` `read_stored_file` уже sync но `read_stored_file` → `storage.get` sync в `async def download_project_file` — там уже `read_stored_file` sync, но `download` уже `async`? Проверить — если там тоже блок, добавить `to_thread` (но `read_stored_file` small 25MB, уже `to_thread` в `aput` — здесь `get` тоже должен быть `to_thread`).
- `app/api/v1/files.py:149` `data = read_stored_file(doc.storage_key)` → `data = await asyncio.to_thread(read_stored_file, doc.storage_key)`.

## Не входит
CRLF (TICKET-02), allowlist (TICKET-01 logic).

## Компоненты
- Файлы: `app/api/v1/projects.py`, `app/api/v1/files.py`

## План
1. `grep -n "storage.get" app/api/v1/*.py`.
2. Заменить на `await asyncio.to_thread(...)`.
3. `ruff/mypy`.

## Пограничные случаи
- `storage.get` бросает `FileStorageError` → `except FileStorageError` уже → `await to_thread` сохраняет exception.
- `to_thread` overhead <2ms.

## Тесты
- `test_verification_doc_file_ref_uses_threadpool` — mock `storage.get` sleep 0.1, `await gather` 10 concurrent не блокирует.
- `test_download` уже PASS.

## Критерии приёмки
- [ ] `grep -c "to_thread.*storage.get" app/api/v1/projects.py` >=1.
- [ ] `grep -c "to_thread.*read_stored_file" app/api/v1/files.py` >=1 (если решили).
- [ ] `mypy` pass (async `await`).

## Команды проверки
- `.venv/bin/pytest tests/test_file_storage.py -q`
- `.venv/bin/mypy app`

## Риски
- `await` забыт → `coroutine` leak — `mypy` поймает.
