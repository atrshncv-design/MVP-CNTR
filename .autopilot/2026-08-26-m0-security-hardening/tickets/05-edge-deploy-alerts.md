# 05 — Край контура: Telegram-алерты, откат деплоя, Grafana внутрь

**Требования:** R11, R12, R13, R17i
**Blocked by:** 04 (маркер свежести бэкапа и его env-контракт; проводка таймера бэкапа и WAL-тома в compose)
**Зона:** `technozrelost-backend/infra/docker-compose.prod.yml`, `deploy.sh`, новый `infra/alerter/`, README инфры
**Волна:** 2
**Status:** code/local complete; external verification pending

## Что должно заработать

О проблемах платформы владелец узнаёт в Telegram за минуты: упал readiness, недоступна реплика,
устарел бэкап, диск заполняется, offsite не настроен. Активная авария не заваливает сообщениями —
одно уведомление и одно «восстановлено». Деплой сам проверяет здоровье после выката и
автоматически возвращается к предыдущим образам при неудаче. Панель мониторинга больше не видна
интернету и не существует с паролем по умолчанию.

## Из брифа, дословно

> «INF-05: алерты (Telegram)» · «INF-06: health-gate и rollback в deploy.sh»
> «INF-07: Grafana внутрь контура»

## Разделы спецификации

Истории 14–16; Решения §алертер, §rollback, §Grafana; таблица соответствия (INF-05..07).

## Критерии приёмки

- [x] Алертер, дедупликация, health-gate/rollback и закрытие Grafana реализованы; alerter `28 passed`, focused local checks green
- [x] Имена Telegram-переменных задокументированы без значений; проверка выполняется без секретов
- [ ] Live Telegram delivery с operator-provided configuration
- [ ] Production-like deploy health-gate и намеренно неудачный rollback smoke
- [ ] Внешняя приёмка и commit: поздние infra repairs dirty/uncommitted и не покрыты baseline hashes
