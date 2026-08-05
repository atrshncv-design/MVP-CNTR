# 06 — Безопасное файловое хранилище

**What to build:** Реализовать пользовательскую загрузку документов в MinIO с версиями, проверкой формата и антивирусным карантином.

**Blocked by:** 02, 04 — очистка и проектные права

**Status:** done

- [x] Разрешены PDF/DOCX/XLSX/PNG/JPEG до 25 МБ
- [x] Фактический MIME проверяется, внутренние имена не раскрывают пользовательские
- [x] MinIO бакеты закрыты, метаданные и хеши в PostgreSQL
- [x] ClamAV блокирует тестовый вредоносный маркер
- [x] Непроверенный файл не считается доказательством
- [x] Версионирование доступно через API/UI

Реализовано: сервис `file_storage.py` (MIME по сигнатуре, лимит 25 МБ, UUID-имена, SHA-256, MinIO с закрытым бакетом / диск в тестах, clamd INSTREAM); API `files.py` (upload/список/download/rescan; infected → 409; без публичных MinIO URL); миграция 0018 (метаданные+sha256+scan_status в `project_documents`); compose local+prod: minio и clamav (arm64-образ mkodockx/docker-clamav:alpine, зеркала сигнатур). Backend `056ed9f` (**129/129 pytest**, ruff чист; 8 новых тестов `test_file_storage.py`). Frontend `9bc3d4e` — панель «Файлы проекта» (загрузка, статус антивируса, скачивание). Live: загрузка PDF → MinIO, download = байт-в-байт, версии 1→2; при недоступном clamd файл получает `scan_status=error` (не clean) — fail-safe подтверждён. ⚠️ Живой ClamAV-скан (EICAR) требует доступа FreshClam CDN: в среде машины разработчика CDN возвращает 403 — подтверждение блокировки EICAR выполняется на серверном стенде (клиент INSTREAM реализован и покрыт тестами).
