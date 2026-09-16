# SPEC-02: Асинхронная устойчивость throttling (H-02a)

## Контекст
`auth_throttle.py:42` (`_get_redis` → `redis.Redis.from_url(...).ping/incr/expire`) — синхронный клиент в `async def login` (`auth.py:91` `is_blocked/record_failure`). Аналогично `nioktr.py:46` registry limit. При каждом `POST /auth/login` event loop блокируется на `socket_connect_timeout 1s` + `ping` — при 100 RPS и недоступном Redis p95 → 1с, как уже закрытый `P-02` (`file_storage.aput to_thread`). `BACKLOG.md` `N-07` LRU 5k/60s — fallback, но Redis-ветка должна быть async. Затронуты `app/services/auth_throttle.py`, `app/api/v1/nioktr.py`, `app/core/config.py` (`redis_url`), `infra/docker-compose.prod.yml` (Redis `requirepass` уже есть с INF-16).

## Цель
Throttling не блокирует loop: `is_blocked/record_failure/record_success` не делают sync I/O в loop; при 1000 VU p95 `POST /auth/login` не деградирует из-за Redis.

## Не входит
Изменение лимитов `LIMIT 10/60s` (`N-07`), `REGISTRY_ANON 120` — остаются. Не меняем `nginx` лимиты (SPEC-05). Не выносим Redis в отдельный сервис (уже есть).

## Функциональные требования
- `FR-01` `POST /auth/login` при недоступном Redis (таймаут 1с) всё ещё отвечает ≤200ms p95 (fallback LRU).
- `FR-02` При доступном Redis счётчик `throttle:{hash}:{ip}` инкрементируется корректно, `LIMIT 10` срабатывает одинаково с 1 или 2 репликами backend (общий Redis).
- `FR-03` `GET /nioktr` anon `120/60s` и auth `10000/60s` enforcement сохраняется после рефактора.
- `FR-04` Fallback LRU 5k/60s (`OrderedDict`, `move_to_end`) сохраняется при `REDIS_URL=""`.

## Нефункциональные
- Производительность: `to_thread` overhead ≤2ms, не создавать новый `Redis` клиент на каждый запрос (переиспользовать singleton).
- Надёжность: `Redis` недоступен → не 500, а LRU.

## Техническое решение
- Вариант A (рекомендуемый, S): оставить `redis` sync, но обернуть `ping/incr/expire/get/delete` в `await asyncio.to_thread(...)` внутри `is_blocked/record_*`. `is_blocked` станет `async def` → обновить все вызовы `auth.py:47,92` `await is_blocked`, `auth.py:75 record_failure` уже sync но внутри `to_thread`. Альтернатива B — `redis.asyncio` — требует `async Redis` singleton, менять больше файлов, но чище. Выбрать A для минимального диффа, B как follow-up P3.
- `nioktr.py:46` аналогично: `_enforce_registry_limit` уже `def` sync, но вызывается из `async` путей — обернуть Redis-часть в `to_thread` или сделать `async def _enforce_registry_limit`.
- `settings.redis_url` остаётся `str|None`, `REDIS_PASSWORD` уже в `docker-compose.prod.yml`.
- Не менять `auth_throttle.MAX_ENTRIES` 5000, `WINDOW 60s`.

## Сценарии
- **Given** Redis доступен, **When** 11 `POST /auth/login` с неверным паролем с одного IP, **Then** 11-й → 429, `GET throttle:...` в Redis =11, TTL 60.
- **Given** Redis недоступен (firewall), **When** 11 аналогичных, **Then** 11-й → 429 via LRU, не 500, latency <200ms.
- **Given** 2 реплики backend, **When** 10 запросов via replica1 +1 via replica2 same IP, **Then** 11-й → 429 (общий Redis, не 10+1).
- **Given** `GET /nioktr?search=xxx` anon, **When** 121 запрос за 60s, **Then** 121-й → 429, auth с токеном → 10k лимит, не 121.

## Безопасность
- Throttle key = `sha256(email):ip` — email хеш, не plaintext.
- `source_from_request` уже `X-Real-IP` → last hop XFF → `client.host` (N-13), не менять.

## Тестирование
- Unit: `test_auth_throttle_async_not_blocking` — mock `redis.Redis.ping` sleep 0.5, `asyncio.gather` 20 `is_blocked` не блокирует loop (`time <0.2`).
- Integration: `test_registry_limit_async` — anon 121 → 429, auth 10001 → 429 (с Redis).
- Load: `loadtest.py --users 100` login storm, p95 <500ms (как `infra/README-LOADTEST.md:44`).

## Критерии приёмки
- [ ] `grep -n "to_thread.*redis\|redis.asyncio"` в `auth_throttle.py`/`nioktr.py`.
- [ ] `is_blocked` стал `async` и `auth.py` `await is_blocked`.
- [ ] `ruff/mypy` strict pass, `pytest` 347+ pass, `loadtest` registry p95 <500ms.

## DoD
FR, тесты, дока `auth_throttle.py` коммент “async via to_thread”, нет sync `redis` в loop, `npm` untouched.
