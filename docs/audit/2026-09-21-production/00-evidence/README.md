# Evidence — baseline (ticket 01)

Протокол: каждое доказательство хранит команду, UTC/локальную дату, target,
exit/status, краткий санитизированный вывод и ссылку на finding/feature.
Сырые логи и транскрипты не коммитятся. Секреты — только именами, значений нет.
Все команды read-only; mutations не выполнялось.

## Реестр

| ID | Файл | Источник |
|----|------|----------|
| EV-001 | `EV-001-local-git.md` | локальный checkout, origin |
| EV-002 | `EV-002-server-git.md` | сервер, deployment checkout |
| EV-003 | `EV-003-runtime-manifests.md` | OS/runtime/Docker/images/services/manifests |
| EV-004 | `EV-004-public-http.md` | публичные health/ready/landing/metrics |
| EV-005 | `EV-005-cicd-deploy.md` | CI/CD, deploy events, образы (metadata) |
| EV-006 | `EV-006-ops.md` | logs/backup/WAL/monitoring/alerting metadata |
| EV-007 | `EV-007-production-compose-sanitized.md` | prod compose config без values (ключи name+set/empty) |
| EV-008 | `EV-008-deploy-log-tail.md` | последнее deploy-событие: безопасный хвост с автомаскировкой |

Даты сбора: UTC 2026-09-21T13:26–13:30Z (EV-001…EV-006); добор blocking
condition 01 — UTC 2026-09-21T16:47–16:55Z (EV-007, EV-008);
локально 2026-09-21 17:26–17:30 и 20:47–20:55 +0400; сервер 2026-09-21 13:27 UTC.

## Stop-сигналы

Проверены при сборе: 5xx — нет (все HTTP 200); unhealthy — нет
(все контейнеры healthy); рост latency — нет (health 0.95с, ready 0.69с,
landing 1.22с — разовые замеры, не SLO); mutation — не выполнялась;
чувствительный вывод — не сохранялся. Остановка не требовалась.

## UNKNOWN (честно недоступное)

- Содержимое `.env`, credential stores, private keys, resolved config — не читались (запрет interfaces).
- Business rows БД, полные логи, сырые транскрипты — не собирались (вне зоны ticket 01).
- Внутренние метрики БД (connections/slow queries/locks) — зона operations-углубления, здесь только metadata.
- Ролевой runtime — до test accounts `UNKNOWN` (R36).
