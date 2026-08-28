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

