# Handoff 02-1 — миграция ошибок на каталог (эстафета от 2026-09-07)

Состояние: сделано 2 файла из ~20 (auth.py, nioktr.py), сюита зелёная (399 passed). Записано со слов исполнителя, который вернул HANDOFF.

## РЕШЕНИЯ

- Паттерн миграции: `raise raise_error(CODE[, params], request=request)`; где не было `Request` — добавить параметр (прецедент: `refresh()`).
- Статусы берутся из каталога; ru по умолчанию держит старые тесты зелёными.
- `except HTTPException: raise` в nioktr оставлен — перебрасывает ошибки каталога.
- Пробы локали — tests/test_api_error_locale.py (login + лимит реестра).

## ТУПИКИ

- Тупиков не зафиксировано.

## ДАЛЬШЕ

- Пофайльно тем же паттерном: news, stages, projects, profiles, membership, invites, manager, requests, users, realtime, files, assessments, generation, rag, achievements, notifications.
- Цепочки ValueError/str(exc) через file_storage/document_generator.
- Пробросить readiness_text и SCAN_LABELS (ключей в каталоге пока нет — добавить).
- 401 «Не авторизован» живёт в app/core/deps.py — разрешено тронуть в этом таске только ради него (см. interfaces.md).
- Пробы расширять пофайльно; сюита должна оставаться зелёной.
