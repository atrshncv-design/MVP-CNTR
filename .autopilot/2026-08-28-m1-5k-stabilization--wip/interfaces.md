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

