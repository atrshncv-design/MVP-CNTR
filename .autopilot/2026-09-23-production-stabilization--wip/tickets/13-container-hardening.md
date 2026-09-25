# 13 — SEC-01: least-privilege container hardening

**Требования:** R23 (SEC-01), R28. **Blocked by:** 12. **Зона:** `technozrelost-backend/infra/docker-compose.yml`, `technozrelost-backend/infra/docker-compose.prod.yml`, `technozrelost-backend/Dockerfile`, `technozrelost-frontend/Dockerfile`, `technozrelost-backend/tests/test_container_hardening.py`, `technozrelost-backend/infra/container-hardening-runbook.md`. **Волна:** 4. **Status:** done with concerns; runtime UID/entrypoint/volume behavior remains UNKNOWN pending approved staging rehearsal.

## Что должно заработать

Compose production no longer leaves compatible services at image-default root with unrestricted capabilities. The custom backend/frontend images and Compose service policies enforce the narrowest practical runtime user, capability, privilege-escalation, and filesystem policy. Any service that demonstrably requires root or writable rootfs is explicitly excepted with evidence, a constrained writable path, and compensating isolation. Dev Compose remains usable and receives the same least-privilege treatment where compatible.

## Из брифа, дословно

> «T13 — SEC-01: non-root/capabilities/read-only hardening»
> «Инфраструктурное (SEC-01, DB-04, DB-05, OPS-02/03) готовится как код + тесты + runbook + change plan + rollback + stop conditions, применяется только после отдельного разрешения.»

## Разделы спецификации

Спецификация: §Решение; §SEC-01 hardening / правила инфраструктурных изменений (R23, R28); §Запреты production и стоп-триггеры; §Состав change plan.
Источник finding: `docs/audit/2026-09-21-production/05-security/findings.json`, SEC-01; аудит-bазлайн immutable.

## Критерии приёмки

- [ ] Backend/Frontend custom images запускают приложение под непривилегированным UID/GID, если runtime design это поддерживает; writable ownership задаётся при build, без root runtime workaround.
- [ ] В prod Compose каждый совместимый сервис задаёт непривилегированного пользователя, `cap_drop: [ALL]` (только доказанные минимальные capabilities могут быть возвращены), `no-new-privileges` и read-only rootfs с явными writable mounts/tmpfs там, где процессу необходимо писать.
- [ ] Оба Compose-файла проверены по всем сервисам. Исключения (в частности image entrypoints, которым нужен root) перечислены в runbook с точной причиной, writable surface и компенсирующей мерой; исключение не маскируется общим PASS.
- [ ] Regression-тест обнаруживает удаление/ослабление обязательных runtime security settings и проверяет, что заявленные исключения документированы. Compose-конфигурации синтаксически валидны; тесты не требуют запуска контейнеров.
- [ ] Runbook содержит локальные validation-команды, change plan, предварительные условия, наблюдаемые health/readiness criteria, rollback и немедленные stop conditions. Ни одна команда не применяется к production в этом таске.
- [ ] Focused test, Ruff, mypy и полный backend regression suite проходят; нет изменений схемы/данных, секретов, image upgrades или иных незапрошенных продуктов.

## Проверка и ограничения

- Для Compose validation использовать только синтетические значения окружения, `docker compose config --quiet` без вывода resolved config; реальные `.env`, secrets и credential stores не читать.
- Разрешено: локальный static/config validation и тесты. Запрещено: `docker compose up/down`, build/pull из сети, запуск/рестарт контейнеров, изменение production, deployment, миграции и реальные health probes.
- Не менять зависимости, lock-файлы, CI, backup/at-rest, AI, nginx, API, БД или файлы вне перечисленной зоны. Не коммитить/пушить.
- Если образ/entrypoint/runtime behavior нельзя безопасно подтвердить без запуска контейнера, не угадывать: ограничить политику подтверждёнными сервисами, описать точную неопределённость и вернуть `DONE_WITH_CONCERNS` или `BLOCKED`.
