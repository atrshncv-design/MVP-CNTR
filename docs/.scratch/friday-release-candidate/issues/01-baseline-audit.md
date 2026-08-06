# 01 — Аудит фактического состояния и release baseline

**What to build:** Проверить существующий продукт от публичной витрины до backend/infra, сопоставить фактическое поведение со спецификацией и создать воспроизводимую исходную линию, не меняя бизнес-логику.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Зафиксированы рабочие маршруты, API, миграции, сервисы и тесты
- [x] Каждое расхождение со спецификацией классифицировано как missing, broken, obsolete или verified
- [x] Исходные lint/type/build/pytest/smoke запущены и результаты записаны
- [x] Пользовательские незакоммиченные изменения не затронуты

Результат: `.scratch/friday-release-candidate/baseline-audit.md` (05.08.2026). Backend 97/97 pytest + ruff чист; frontend lint/tsc/build зелёные, node-тесты 4/5 (stale-ассерт `const statCards` → фикс в тикете 02); compose валиден; миграции 0015 head; live-smoke: health/ready/register 200, защищённые 401. Расхождения: V10 / M18 (профили, приглашения, официальный УГТ≤2, MinIO/ClamAV, комментарии/PDF, приватность, realtime, темы, Docker-контур, demo reset, backup, load/security) / B2 (публичные реестры закрыты auth — 401 без токена; stale-тест).
