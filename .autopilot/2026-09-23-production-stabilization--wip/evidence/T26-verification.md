# T26 — Redis SSE factory typing

Дата: 2026-09-24. Code commit `4236c95`, отправлен в `origin/autopilot/production-stabilization`.

- RED: канонический Python 3.11 `mypy app` → `app/api/v1/realtime.py:109 [no-untyped-call]` плюс T27 `app/main.py:311 [arg-type]` (`T04-verification.md`).
- Минимальный diff: фабрика `redis.asyncio.from_url` заменена на эквивалентный `Redis.from_url`; только локальная ссылка на нетипизированный factory из redis-py 5.2.1 помечена `Any` с точечным `ignore[no-untyped-call]`. URL, timeouts, `decode_responses`, exception/fallback и четыре call sites не менялись.
- Независимый Python 3.11 `mypy app`: 62 файла, **только одна оставшаяся ошибка T27**; T26 ошибка исчезла. Независимый `pytest tests/test_sse_ticket.py -q`: 10 passed, 2 dependency warnings; Ruff по изменённому файлу exit 0; `git diff --check` чисто.
- Независимое read-only review: PASS, блокирующих замечаний нет; runtime Redis API подтверждает делегирование module-level `from_url` к `Redis.from_url`.
- Production, CI, lock, секреты и публичный интерфейс не изменялись. Полный backend regression будет повторён после T27.
