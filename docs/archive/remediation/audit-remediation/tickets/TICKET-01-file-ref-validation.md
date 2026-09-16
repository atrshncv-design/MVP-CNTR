# TICKET-01: Валидация file_ref без bypass (H-01)

- **Связанная спецификация:** SPEC-01
- **Связанные проблемы аудита:** H-01 (N-15 bypass `"/" in file_ref`)
- **Приоритет:** P0
- **Критичность:** High
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-02,03,04,05,08,09

## Проблема
`app/api/v1/projects.py:671` — `if payload.file_ref and "/" in payload.file_ref:` → только пути со слэшем валидируются через `ProjectDocument.storage_key` / `storage.get`. Строка `file_ref="evil-no-slash"` обходит проверку и создаёт `VerificationDocument` с фейковым доказательством. Подтверждено код-ревью и ручным `POST .../verification-docs` → 201 вместо 404.

## Требуемый результат
Любой непустой `file_ref` валидируется: либо `storage_key` существует в `project_documents` того же проекта, либо `storage.get(file_ref)` не бросает `FileStorageError`; иначе 404 `Файл не найден`. Легаси `ref-1` (из `tests/support.py`) — allowlist, остальные без слэша — 404. `file_ref=""` или `None` — как раньше 201 (optional).

## Объём работ
- `app/api/v1/projects.py:671` заменить `if "/" in` на `if payload.file_ref:` + `LEGACY_ALLOWLIST = {"ref-1","ref-2"}` (константа в `app/core/config.py` или локально) → `if payload.file_ref in LEGACY_ALLOWLIST: pass else: await to_thread(storage.get, ...)` (см. TICKET-10 для `to_thread` — если TICKET-10 раньше, использовать `to_thread` сразу).
- `app/core/config.py` — добавить `legacy_file_ref_allowlist: set[str] = {"ref-1"}` если выносим.
- Миграция `0032_file_ref_allowlist.sql` — не нужна схема, но добавить `COMMENT ON COLUMN verification_documents.file_ref IS 'legacy allowlist ref-1'` или просто без миграции (allowlist в коде).
- `alembic/versions/0032_*.py` — только если коммент.

## Не входит
CRLF (TICKET-02), async (TICKET-10 можно совместить, но держать отдельные коммиты: TICKET-01 — синхронно, TICKET-10 — async рефактор).

## Затрагиваемые компоненты
- Файлы: `app/api/v1/projects.py`, `app/core/config.py` (опц.), `alembic/versions/0032*` (опц.)
- Эндпоинт: `POST /projects/{id}/verification-docs`
- Таблица: `verification_documents.file_ref` (чтение)

## План реализации
1. `grep -n "file_ref" app/api/v1/projects.py` → 671.
2. Заменить условие, добавить `LEGACY_ALLOWLIST` const, `try: storage.get` → `except FileStorageError: 404`.
3. Если TICKET-10 ещё не done — оставить sync `storage.get`, пометить `TODO: to_thread in TICKET-10`.
4. `ruff check app` / `mypy app`.
5. `pytest tests/test_file_ref_remediation.py` (создать в TICKET-16, но локально проверить `curl`).

## Пограничные случаи
- `file_ref=None` → не валидировать.
- `file_ref="projects/1/uuid.pdf"` где `storage_key` в `project_documents` другого проекта → `storage.get` проверит MinIO, но не принадлежность — тогда `404` vs `403`? Сейчас 404 — оставить, не раскрывать существование чужого проекта.
- `LEGACY_ALLOWLIST` — только точные значения, не префикс.

## Тесты
- `test_file_ref_rejects_non_slash_missing` → `POST ... {"file_ref":"evil"} → 404` (см. SPEC-08).
- `test_file_ref_allows_legacy_allowlist` → `ref-1 → 201`.
- `test_file_ref_allows_real_storage_key` → загрузить файл, взять `storage_key`, `POST verification-docs` с ним → 201.

## Критерии приёмки
- [ ] `evil` → 404, `ref-1` → 201, реальный key → 201, `""` → 201.
- [ ] `grep -c '"/" in.*file_ref' app/api/v1/projects.py` ==0.
- [ ] `ruff/mypy` pass, `pytest` green.

## Команды проверки
- `technozrelost-backend/.venv/bin/pytest tests/test_file_ref_remediation.py -q`
- `.venv/bin/ruff check app && .venv/bin/mypy app`

## Риски
- Регресс: старые `verification_documents` с `file_ref="ref-1"` — allowlist предотвращает 404 на чтение (чтение не валидирует, только запись).
- Миграция не нужна — rollback просто revert commit.
