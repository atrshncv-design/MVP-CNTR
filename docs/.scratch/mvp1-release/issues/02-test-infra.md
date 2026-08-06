# 02 — Тест-инфраструктура бэкенда

**What to build:** Настроить pytest с изолированной тестовой схемой `test`: фикстуры (тестовая БД-сессия, API-клиент, тестовые пользователи и роли), конфиг в pyproject, смоук-тесты: `/health` и полный цикл `/auth/register` → `/auth/login` → `/auth/me`. Команда `uv run pytest` зелёная.

**Blocked by:** 01 — Инфраструктура разработки

**Status:** ready-for-agent

- [ ] Тесты работают на схеме `test`, не затрагивая `public`
- [ ] Смоук: health 200; register → login → me проходит
- [ ] `uv run pytest` — зелёный прогон
