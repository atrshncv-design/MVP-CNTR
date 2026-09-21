# EV-006 — logs, backup/WAL, monitoring/alerting (metadata)

- Дата: UTC 2026-09-21T13:27–13:28Z
- Target: сервер (SSH, read-only): имена контейнеров, volumes, файлы-маркеры,
  timers, имена job в `prometheus.yml`. Содержимое логов, дампов и конфигов
  не читалось и не копировалось.
- Exit: 0 (два штатных отсутствия зафиксированы ниже как факты, не ошибки).

## Logs (metadata)

- Контейнеры-источники логов (12 имён из `docker ps` — EV-003, дубли не повторяются).
- Хостовая ротация: `logrotate.timer` активен (следующий запуск 2026-09-22
  00:41 UTC, `systemctl list-timers`); конфиги ротации приложений — UNKNOWN
  (зона operations-углубления).
- Deploy/seed/load-логи: см. EV-005 (там же метаданные).

## Backup / WAL (metadata, без содержимого)

- Volumes (именами): `technozrelost-prod_backups-prod-data`,
  `technozrelost-prod_pg-prod-primary-data`,
  `technozrelost-prod_wal-archive-prod-data` (scope local).
- Маркеры свежести в backups-volume (имена+даты, без значений):
  `.backup-freshness` (2026-09-21 08:03), `.offsite-status` (2026-09-21 08:03),
  `.pre-migration-backup` (2026-09-21 08:03), `.wal-offsite-status` (2026-09-21 13:27)
- Снапшоты-каталоги (имена+даты): `20260921T031509Z.*`, `20260921T063659Z.*`,
  `20260921T072818Z.*` — не менее 3 свежих в день аудита (глубина/целостность/RPO —
  operations-отчёт, restore не запускался).
- Скрипты (имена): `infra/backup.sh`, `infra/restore.sh`, `infra/backup-lock.py`.
- Сервисы: `backup-timer`, `wal-offsite` — оба Up (healthy), EV-003.
- Отсутствует как факт: `/var/backups/technozrelost/` и `/var/lib/postgresql/`
  на хосте (ожидаемо при volume-топологии, не дефект само по себе).
- Размер данных PG: `du` показал 136M (`/var/lib/postgresql/data` внутри
  контейнера) — размер, не содержимое.

## Monitoring / alerting (metadata)

- `tz-prod-prometheus` (v2.54.1) и `tz-prod-grafana` (11.2.0) — Up 4 days (healthy).
- Targets: `prometheus.yml` содержит job `technozrelost-backend`
  (полный scrape-конфиг не читался).
- Alerter: `infra/alerter/alerter.py` + `test_alerter.py`, контейнер
  `technozrelost-prod-alerter-1` Up (healthy); `infra/grafana/dashboard.json` +
  `provisioning/` присутствуют (именами).
- Правила алертов, каналы уведомлений, значения порогов — не читались
  (возможны секреты получателей); оценка покрытия — operations-отчёт.

## Resources (разовый срез, не SLO)

- `docker stats` на момент замера (имя — CPU — MEM/LIMIT):
  frontend 0.00% 134.9MiB/768MiB; backend 0.21% 117.5MiB/1.5GiB;
  backup-timer 0.00% 808KiB/128MiB; wal-offsite 1.42% 1.219MiB/128MiB;
  alerter 0.00% 26.61MiB/128MiB; grafana 0.12% 87.43MiB/256MiB;
  prometheus 0.03% 46.22MiB/384MiB; nginx 0.00% 9.758MiB/128MiB;
  redis 0.44% 4.027MiB/256MiB; db-primary 0.00% 95.29MiB/1.5GiB;
  minio 0.00% 263.4MiB/384MiB; clamav 0.03% 964.9MiB/2GiB.

## Связь со spec

- R06/R23–R25, контур «эксплуатация»: metadata закрыта; RPO/RTO/restore/
  rollback/SPOF/очереди/DLQ — operations-отчёт (restore/нагрузка не запускались).
- Ссылки: `01-environments.md` (Operations metadata, Ограничения).
