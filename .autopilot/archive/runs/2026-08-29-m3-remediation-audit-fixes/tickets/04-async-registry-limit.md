# TICKET-04: Async registry limit (H-02a часть 2)

- **Спека:** SPEC-02
- **Проблемы:** H-02a (`nioktr.py:46` sync Redis)
- **Приоритет:** P0
- **Критичность:** High
- **Сложность:** S
- **Зависимости:** — (можно после TICKET-03, но независимо)
- **Можно параллельно с:** TICKET-03

## Проблема
`nioktr.py:46` `_enforce_registry_limit` sync `redis.Redis.incr` в `async def list_nioktr_cards` (`nioktr.py:88`) → тот же блок loop.

## Требуемый результат
`_enforce_registry_limit` не блокирует loop: `await to_thread` для Redis-части, `REGISTRY_ANON 120` / `AUTH 10000` сохраняются.

## Объём работ
- `app/api/v1/nioktr.py:46` — сделать `async def _enforce_registry_limit` или оставить sync но `await to_thread` внутри: `count = await asyncio.to_thread(client.incr, rkey)` + `await to_thread(client.expire, ...)` + `await to_thread(client.ttl, ...)`.
- Вызовы `list_nioktr_cards`/`list_organizations` уже `await`? Сейчас ` _enforce_registry_limit(request)` sync без `await` — сделать `await _enforce_registry_limit(request)`.
- `import asyncio` добавить.

## Не входит
Изменение лимитов, `auth_throttle` (TICKET-03).

## Компоненты
- Файл: `app/api/v1/nioktr.py`

## План
1. `read nioktr.py:46..90`.
2. Обернуть Redis `incr/expire/ttl` в `to_thread`.
3. Сделать функцию `async`, обновить вызовы на `await`.
4. `mypy/ruff/pytest`.

## Пограничные случаи
- `REDIS_URL=""` → LRU fallback, не `to_thread`.
- `Authorization` header → `REGISTRY_AUTH_LIMIT 10000`, иначе 120.

## Тесты
- `test_registry_limit_async` — anon 121 → 429, auth 10k → ok.
- `test_nioktr_list_and_filters` уже PASS.

## Критерии приёмки
- [ ] `_enforce_registry_limit` `async` + `to_thread`.
- [ ] `pytest -k test_nioktr` PASS.

## Команды проверки
- `.venv/bin/pytest tests/test_nioktr.py tests/test_performance_indexes.py -q`
- `.venv/bin/mypy app`

## Риски
- Забыть `await` в `list_organizations` → не лимитирует — тест на 121 поймает.
