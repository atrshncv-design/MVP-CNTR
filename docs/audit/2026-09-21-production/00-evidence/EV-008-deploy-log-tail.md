# EV-008 — последнее deployment-событие: безопасный хвост журнала

- Дата: UTC 2026-09-21T16:47–16:55Z / локально 2026-09-21 20:47–20:55 +0400 / сервер UTC
- Target: `root@213.139.209.165`, файл `~/deploy.log` (только чтение хвоста/головы
  через серверный санитайзер; сырой лог не копировался, полные тела не коммитятся)
- Команды (read-only): `wc -l`, `stat` (metadata); `python3`-санитайзер поверх
  `head -15` + `tail -30` с автоматической маскировкой:
  email→`<email>`, `bearer <…>`→`bearer <token>`, JWT→`<jwt>`,
  `(password|secret|api-key|token|cookie|session|authorization)[:=]…`→`<redacted>`,
  RU-телефоны `+7…`/`8…` (10 цифр)→`<phone>`
- Exit: 0. Проверки санитайзера: `HAS_EMAIL` 0, `HAS_BEARER` 0, `HAS_COOKIE` 0;
  12 совпадений широкого паттерна `+?7…` — ложные срабатывания на IP-адресах вида
  `999.999.999.999`; строгий RU-паттерн в выданном хвосте замен не потребовал.
  Проектный контент (бизнес-строки) в выданных строках отсутствует — только шаги
  деплоя, имена контейнеров/образов, статусы, публичный URL.

## Метаданные файла

- `~/deploy.log`: 10544 B, 266 строк, mtime 2026-09-17 13:20 UTC
  (последнее файловое событие за 4 дня до аудита).

## Санитизированная голова (строки 1–15, сокращения до 220 симв.)

- 1: `PREFLIGHT OK: 6 vCPU / 11 ГиБ / 60 ГБ свободно; сумма лимитов <= 8 ГиБ / 6 vCPU`
- 2: `TLS-GATE OK: https://technozrelost.atrshnjc.beget.tech (SAN и годность в норме, 301 с 213.139.209.165.sslip.io)`
- 3: `301-редирект 213.139.209.165.sslip.io → https://technozrelost.atrshnjc.beget.tech записан в nginx/legacy/redirect.conf.`
- 4: `ROUTING-GATE OK: technozrelost.atrshnjc.beget.tech в основном сайте, 301 с 213.139.209.165.sslip.io (порядок инклудов не влияет)`
- 5: `Предыдущие backend/frontend образы сохранены под тегом previous.`
- 6: `Собираю и поднимаю стек с image tag 8651cced865c...`
- 7–9: `wal-offsite/backup-timer/alerter Pulling`
- 10–12: `alerter/backup-timer/wal-offsite Error pull access denied for technozrelost-backend, repository does not exist or may require 'docker login'`
  (штатный fallback на локальную сборку; далее `#0 building with "default" instance using docker driver`)
- 13–15: `Compose can now delegate builds to bake… set COMPOSE_BAKE=true` (подсказка compose, не ошибка).

## Санитизированный хвост (строки 237–266 — последнее событие)

- 237–253: `Container tz-prod-db-primary/minio/redis/clamav Healthy; wal-offsite/backup-timer Starting→Started; tz-prod-backend Starting→Started; alerter Started`
- 254–262: `tz-prod-frontend Starting→Started→Waiting→Healthy; tz-prod-prometheus Waiting→Healthy; tz-prod-backend Waiting→Healthy`
- 263: `301-редирект не изменился — reload nginx не нужен (nginx/legacy/redirect.conf).`
- 264: `Выкладка 8651cced865c прошла health-gate.`
- 265: `Проверка: curl https://technozrelost.atrshnjc.beget.tech/api/v1/health`
- 266: `Сертификат: выпуск — ./tls_issue.sh, продление — ./tls_renew.sh.`

## Расхождение (факт, не вывод)

- Хвост подтверждает последнее *файловое* событие: тег `8651cced865c`, health-gate
  пройден 2026-09-17. Сейчас запущено `f06b15cb76ef` (EV-002/EV-003): файловое событие
  ≠ running state. Пересборка/перезапуск после 09-17 в `deploy.log` не отражены
  (контейнеры Up 5ч/4д на 2026-09-21 — EV-003). Ссылка для findings/operations:
  `deploy-log-trail-behind-running`.
- Mutations: ни одной. Секретов/ПДн/бизнес-строк в этом файле нет.

## Связь со spec

- R06 (первая половина blocking condition 01): последнее deployment-событие
  подтверждено безопасным хвостом с автоматической маскировкой, а не только
  metadata — закрыто этим файлом (дополняет EV-005).
- Решения 4 (read-only, низкая частота), 6 (протокол evidence); Решение 7:
  deployed-факт.
- Ссылки: `01-environments.md` (Deploy events); EV-005 (metadata), EV-003 (running).
