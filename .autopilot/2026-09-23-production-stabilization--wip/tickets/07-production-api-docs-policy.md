# 07 — SEC-03: явная политика OpenAPI-документации

**Требование:** R24 (часть SEC-03). **После:** T06 и regression-гейта. **Зона:** backend FastAPI composition и узкие backend-тесты.

## Контекст и RED

`docs/audit/2026-09-21-production/09-final/findings.json` → `SEC-03`: в коде `FastAPI(...)` не задана политика `docs_url`/`redoc_url`/`openapi_url`; публичная доступность deployed `/docs` осталась `UNKNOWN`. Не превращать это UNKNOWN в утверждение. Сначала локальными тестами подтвердить текущую доступность docs/OpenAPI в `APP_ENV=production` (на изолированном test app, без сервера production) и сформулировать политику: в production они закрыты, в dev/test доступны.

## Изменение

- Минимально задать FastAPI docs/OpenAPI URLs по уже существующему `settings.app_env`, без нового флага и без изменения продуктовых API.
- Тесты: production app не отдаёт `/docs`, `/redoc`, `/openapi.json`; dev/test app сохраняет их. Не создавать production-аккаунты и не читать `.env`/секреты.
- Не делать production HTTP-пробу и не менять nginx/compose/deployment в этом тикете. Фактическое deployed-состояние оставить `UNKNOWN` до отдельно разрешённой безопасной проверки/выкладки; локальный code-policy и deployed proof — разные утверждения.

## Приёмка

Focused RED→GREEN tests, Ruff, mypy и затронутые backend tests проходят; полный suite — оркестратор на regression-гейте. Diff только в app composition/test. Исполнитель сдаёт выводы и честный deployed UNKNOWN, не правит `.autopilot/**`, не коммитит/push'ит.
