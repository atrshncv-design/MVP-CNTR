# 04 — БД и защита данных

**Требования:** R03, R11, R12, R14, R26, R30, R31
**Blocked by:** 01
**Зона:** `docs/audit/2026-09-21-production/04-database/`
**Волна:** 4
**Status:** ready

## Что должно заработать

Статическая ORM/migrations-модель сопоставлена с production schema metadata, constraints, indexes, sizes и aggregate counts. Ни одна business row не читается.

## Критерии приёмки

- [ ] Весь DB/data-protection checklist spec покрыт доказательно или `UNKNOWN`.
- [ ] Migration head/drift, ORM/schema mismatches, constraints/indexes/roles/network/backup encryption и isolation отражены.
- [ ] Проверка injection опирается на ORM/query construction и tests, без destructive payloads.
- [ ] Отчёт и findings JSON не содержат ПДн или значения секретов.

## Blocking review condition 01

Исправить только блокеры независимого review:

1. Собрать разрешённые production schema metadata через read-only query внутри `tz-prod-db-primary`, используя уже существующее окружение контейнера без вывода credential values: `alembic_version`, catalog tables/constraints/indexes, безопасные роли/grants, размеры и только агрегированные counts. Никаких business rows. Если конкретный query безопасно не выполняется — приложить фактическую ошибку и `UNKNOWN`, а не предположение о невозможности.
2. Для R14 добавить воспроизводимое static evidence роли + владения проектом + приглашения в models/constraints/query construction либо пометить непроверенные части `UNKNOWN`.
3. Согласовать таблицы: 36 declarative классов с `__tablename__` + 3 Core association `Table` (`role_permissions`, `user_roles`, `news_post_tags`) = 39 объектов `Base.metadata`; сохранить оба числа и их смысл.
4. Сравнение migrations назвать только parity 35 filenames, не content/checksum/applied drift. Applied drift закрывать только production catalog evidence.
5. Удалить invented green test claim. Точный targeted run завершился setup errors из-за отсутствующей test DB; статус `BLOCKED`, с командой и результатом.
6. Удалить предположение `single-tenant B2B topology` и expectedness из DB-02; оставить доказанные отсутствие RLS, app-level controls и `UNKNOWN` runtime.

Больше ничего не менять.

## Blocking review condition 02

Исправить только остаток условия 4 и новый breakage ремонта:

1. Во всех T04-артефактах заменить выводы `drift нет` / `applied drift отсутствует`: `alembic_version=0037` доказывает только parity применённой версии с файловым head. Schema/content/manual drift остаётся `UNKNOWN`, пока definitions/checksums не сравнены. Различия prod unique/check counts и local declarations не объявлять «не drift» без полного поимённого reconciliation.
2. Удалить утверждение, что EXPLAIN/growth/retention остаются UNKNOWN из-за отсутствия read-only доступа без credentials: EV-013 доказал безопасный container-env passthrough. Указать фактическую причину, почему EXPLAIN не запускался (нагрузочный/плановый анализ не входил в этот low-rate metadata repair), либо просто оставить `UNKNOWN` без ложной невозможности.

Больше ничего не менять.
