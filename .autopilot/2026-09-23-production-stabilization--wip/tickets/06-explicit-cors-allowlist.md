# 06 — SEC-02: явный список CORS-методов и заголовков

**Требование:** R24 (часть SEC-02). **После:** T05 и regression-гейта. **Зона:** `technozrelost-backend/app/main.py` и узкие backend-тесты.

## Контекст и RED

`docs/audit/2026-09-21-production/09-final/findings.json` → `SEC-02`: `CORSMiddleware` в `app/main.py` использует `allow_credentials=True` вместе с `allow_methods=["*"]`/`allow_headers=["*"]`. Origins сейчас узкие, но их будущее расширение без review автоматически расширит credentialed preflight. Сначала сверить finding с текущим кодом и фактическими методами/заголовками frontend и API; написать failing preflight tests для разрешённого и запрещённого запроса. Значения `CORS_ORIGINS`/`.env` не читать и не выводить.

## Изменение

- Заменить wildcard методов и заголовков минимальными явными списками, достаточными для существующих клиентов. Не менять allow_origins, credentials policy, бизнес-роуты, auth/session или API-схему.
- Проверить `GET/POST/PUT/PATCH/DELETE` и реально используемые заголовки, включая Authorization/Content-Type; OPTIONS обслуживается preflight механизмом. Не добавлять заголовки «на всякий случай».
- Тестом подтвердить, что разрешённый preflight не ломается, а неразрешённые метод/заголовок не получают разрешение. Никаких production-проб и правок в этом тикете.

## Приёмка

Focused RED→GREEN tests, Ruff, mypy и затронутые backend tests проходят; полный backend suite — оркестратор при регрессии волны. Исполнитель сдаёт diff, список фактически необходимых методов/заголовков и evidence, не меняет `.autopilot/**`, не коммитит/push'ит.
