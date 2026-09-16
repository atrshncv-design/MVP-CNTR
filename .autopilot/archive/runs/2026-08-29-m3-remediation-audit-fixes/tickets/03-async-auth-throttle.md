# TICKET-03: Async throttling auth (H-02a часть 1)

- **Спека:** SPEC-02
- **Проблемы:** H-02a (`auth_throttle.py:42` sync Redis в `auth.py:91`)
- **Приоритет:** P0
- **Критичность:** High
- **Сложность:** M
- **Зависимости:** —
- **Можно параллельно с:** TICKET-04 (но разный файл, можно вместе, лучше последовательно)

## Проблема
`auth_throttle.is_blocked/record_failure` синхронно дергают `redis.Redis.ping/incr` в `async def login/register` (`auth.py:47,92`) → блокировка loop 1s при недоступном Redis → p95 деградация.

## Требуемый результат
`is_blocked/record_failure/record_success` не блокируют loop: Redis-часть через `asyncio.to_thread` (или `redis.asyncio`), `is_blocked` стал `async def`, `auth.py` `await is_blocked`.

## Объём работ
- `app/services/auth_throttle.py` — `async def is_blocked`, `async def record_failure`, `async def record_success` (или оставить sync но внутри `await to_thread`); добавить `import asyncio`; обернуть `client.ping/incr/expire/get/delete` в `await asyncio.to_thread(...)`; сохранить LRU fallback sync.
- `app/api/v1/auth.py:47,92,75` — `if await auth_throttle.is_blocked(...):` и `await auth_throttle.record_failure/success` (в `register` и `login`).
- `app/api/v1/auth.py:75` уже `except IntegrityError: record_failure` — сделать `await`.
- Не менять `LIMIT/WINDOW/MAX_ENTRIES`.

## Не входит
Registry limit (TICKET-04), `X-Request-ID` (TICKET-02).

## Компоненты
- Файлы: `app/services/auth_throttle.py`, `app/api/v1/auth.py`

## План
1. `read auth_throttle.py` → функции sync.
2. Сделать `async def is_blocked`, внутри `try: client = await to_thread(_get_redis)`? Но `_get_redis` sync → `await to_thread(_get_redis)` + `await to_thread(client.get, rkey)`.
3. Обновить `auth.py` вызовы на `await`.
4. `mypy` — `async def` в `mypy strict` ок.
5. `ruff/mypy/pytest`.

## Пограничные случаи
- `REDIS_URL=""` → fallback LRU, не `to_thread`.
- `client.get` возвращает `bytes` → `int(val)` уже.
- `auth_throttle.reset()` в `conftest` — сделать `async`? Оставить sync, т.к. только тесты.

## Тесты
- `test_auth_throttle_async_not_blocking` — mock `redis.Redis.ping` sleep 0.5, `await gather` 20 не блокирует.
- `test_failed_logins_are_rate_limited` уже PASS → не сломать.

## Критерии приёмки
- [ ] `is_blocked` `async`, `auth.py` `await is_blocked`.
- [ ] `grep "to_thread.*redis\|redis.asyncio"` в `auth_throttle.py`.
- [ ] `pytest -k test_auth_throttle` PASS, latency <200ms при Redis down.

## Команды проверки
- `.venv/bin/pytest tests/test_auth_throttle.py -q`
- `.venv/bin/mypy app && .venv/bin/ruff check app`

## Риски
- Забыть `await` → `coroutine never awaited` → `mypy` поймает.
- `record_failure` в `except` без `await` → не инкремент — `mypy` + тест на 11-й 429 поймает.
