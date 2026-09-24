# 32 — D09: readiness-тесты не должны зависеть от REDIS_URL CI

**Требование:** D09, C4 baseline. **После:** T31. **Зона:** только `technozrelost-backend/tests/test_health.py`.

RED: GitHub CI два теста readiness ожидают `redis=not_configured`, но CI запускает Redis и получает `ok` (`evidence/CI-backend-pytest-2026-09-24.md`). Локально подтвердить RED с временным Redis. Минимально изолировать проверяемую ветку `check_redis` в этих тестах (или задать ожидаемый результат в явном тестовом double); не менять production `health.py`, CI env, Redis policy или другие тесты. Сохранить 200 ready/503 not_ready, структуру payload и проверку database roles. Добавить/сохранить отдельный тест реального `check_redis` через существующий контракт, если он уже есть; не делать фиктивно зелёный тест.

Приёмка: оба теста GREEN при `REDIS_URL` пустом и заданном локальном test Redis; focused suite, Ruff/mypy; итоговый CI Pytest после T32–T34. Исполнитель не меняет `.autopilot/**`, не коммитит/push'ит, не трогает production/секреты.
