# Interfaces — границы M1 5К 24 P1

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `backend/throttle` | `auth_throttle.py` Redis | 429 | INCR |
| `backend/loop` | `to_thread` | clean | scan |
| `backend/RAG` | `contour tuno/kaba` | POST /chat/tuno|kaba | vector 1536 |
| `frontend/auth` | `middleware` `api-client` | /login | JWT |
| `infra` | `limits/logs/nginx/DR` | deploy.sh health-gate | toml |
| `interview` | `пагинация 20` `мэтчинг` `админка` | POST /match KPI | sector |

Швы: `pytest 334` `node 39` `ruff/mypy` `security_check.py` `loadtest.py` 714 RPS p95 500мс.

## Из таска 01 — LLM-гейтвей (N-05)

- `Settings.llm_gateway_enabled: bool = False` `app/core/config.py:64` env `LLM_GATEWAY_ENABLED`
- `async def ask_llm(system_prompt: str, user_message: str) -> str | None` `app/services/ai_assistant.py:36` — return None если not gateway_enabled, до httpx
- Тест: `tests/test_llm_gateway.py` 7 passed (341 total)


## Из таска 02 — Throttle/bcrypt/SSE/Scheduler (N-07,N-08,Q-01,P-02,P-03,P-04,N-03)

- `auth_throttle.is_blocked/ record_failure Redis INCR EXPIRE 60 fallback LRU 5k/60s` `app/services/auth_throttle.py:41` `compose:112`
- `POST /auth/register 429 10/60s` `app/api/v1/auth.py:65`
- `users.change_password asyncio.to_thread` `app/api/v1/users.py:70`
- `file_storage.aput/astore_* to_thread` `app/services/file_storage.py:205`
- `main._news_scheduler_loop pg_try_advisory_lock(42)` `app/main.py:186`
- `realtime SSE snapshot+Redis pubsub` `app/api/v1/realtime.py:43` `_fallback_queues`


## Из таска 03 — Frontend auth + audit (FE-03,FE-04)

- `middleware auth` `src/middleware.ts:13` RefreshAccessTokenError → 302 /login
- `api-client apiRequest 401 → signOut` `src/lib/api-client.ts:44` nativeFetch preservation 800ms timeout
- `npm audit 0 high` `package.json:31` overrides, `ci.yml:83` audit step


## Из таска 04 — Индексы и пагинации 5К 20 (P-05,P-06,P-07,P-08)

- `alembic 0028` `ix_*_trgm GIN gin_trgm_ops, ix_nioktr_cards_nioktr_types GIN, ix_organizations_ogrn_hash HASH, ix_nioktr_cards_is_ai_area_btree BTREE` `app/db/models.py` + `0028_indexes_pagination.sql`
- `GET /nioktr/organizations LATERAL card_count` `app/api/v1/nioktr.py:76`
- `GET /nioktr/organizations/{ogrn} limit 20` `nioktr.py:124`
- `GET /projects/registry?after_id&limit=20 keyset id<after_id` `app/api/v1/projects.py:221`
- `GET /executors?after_id&limit=20` `app/api/v1/executors.py:124` Python slice fallback


## Из таска 05 — Инфра лимиты/логи/nginx/DR (INF-08,09,12,13,N-18)

- `compose limits backend 1cpu/2G clamav 2cpu/4G` `infra/docker-compose.prod.yml:29`
- `logging max-size 10m max-file 3` 13 сервисов
- `nginx resolver 127.0.0.11 limit_req zone auth/registry gzip cache _next/static` `nginx.prod.conf:41`
- `DR-runbook docs/RUNBOOK-DR.md` `stop→restore→start` + `02:00` hotfix

