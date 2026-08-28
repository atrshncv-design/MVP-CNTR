# 04 — Сохранность данных: расписание бэкапов, WAL/PITR, слот, offsite

**Требования:** R07, R08, R09, R10, R17i
**Blocked by:** —
**Зона:** `technozrelost-backend/infra/` (postgres-конфиги, backup.sh/restore.sh, новые скрипты) + runbook-документация инфры
**Волна:** 1
**Status:** code/local complete; external verification pending

## Что должно заработать

Бэкап делается каждый день сам, возраст последнего успеха виден машине и человеку.
Непрерывный архив WAL позволяет восстановить состояние на любой момент с потерей не больше
минут. Простой реплики больше не может переполнить диск через слот репликации. Есть шаг
копирования архива на внешний таргет. Вся цепочка восстановления отрепетирована руками
на чистом контейнере и записана в runbook.

## Из брифа, дословно

> «INF-01: расписание бэкапов» · «INF-02: WAL/PITR, „восстановление отрепетировано"»
> «INF-03: max_slot_wal_keep_size» · «INF-04: offsite-копия бэкапов»

## Разделы спецификации

Истории 10–13; Решения §бэкапы, §WAL/PITR, §offsite; таблица соответствия (INF-01..04).

## Критерии приёмки

- [x] Код таймера, маркер свежести, WAL-архив, лимит слота и локальная PITR-репетиция реализованы и локально проверены
- [x] Dev PostgreSQL replication smoke: primary/replica healthy, slot active, replica в recovery, WAL receiver streaming, passfile `0600`
- [x] Runbook описывает процедуры и конфигурационные цели RPO/RTO
- [ ] Подтверждённый production-like scheduled backup и PITR с текущими dirty repairs
- [ ] Live offsite с operator-provided crypt remote/config; до этого RPO/RTO остаются целями конфигурации
- [ ] Коммит и внешняя приёмка: HEAD `7f6ad43`; поздние infra repairs не покрыты историческими commit hashes
