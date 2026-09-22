# 08 — Эксплуатация и производительность (ticket 08)

Read-only оценка по наблюдениям; no load создан не был: ни нагрузочных,
ни fuzz-, ни restore-прогонов, ни рестартов в этом тикете не запускалось.
Deployed-факты переиспользованы из EV-003…EV-008 без повторных проб;
статика — EV-025. Всё без production-доказательства помечено `UNKNOWN`
(Решение 7). Findings: OPS-01…OPS-06 в `findings.json`.

## Исполнение (R30/R31)

Тикет исполнен через адаптер autopilot-opencode моделью
`opencode-go/muse-spark-1.3-contributor`. Значения секретов и credentials не
читались и не сохранялись; в артефактах — только имена ключей.

Точность меток: исходный сбор EV-025 записал только дату `2026-09-22` —
exact UTC исходного сбора timestamp unavailable (время не фиксировалось, не
выдумываем); доказуемая граница из существующих metadata: pre-repair `stat`
mtime `2026-09-22T08:54:23+0400` (= `2026-09-22T04:54:23Z`), повторная
верификация local `2026-09-22T04:59:20Z` (без SSH/HTTP-проб).

Repair note (root cause): EV-025 used a date-only stamp with no provable UTC, omitted R30/R31 provenance, and claimed 22 finding keys instead of the actual 21.

## Reproducibility — закрыто статикой + deployed-паритетом

Выкладка воспроизводима по git SHA: `deploy.sh` тегирует образы текущим SHA
и сохраняет предыдущие под `previous`; CI собирает те же Dockerfile.
Deployed-версия доказана тройным совпадением SHA = image tag = running
(EV-002/EV-003/EV-005). Пины с digest — minio и clamav (EV-025).
Оговорка: файловое deploy-событие отстаёт от running
(`deploy-log-trail-behind-running`, OPS-зависимость в SEC/DB- finding'ах).

## Probes — закрыто

Liveness `/health` (статический `ok`), readiness `/ready` (Primary `SELECT 1`,
Replica, Redis ping, storage, clamd; fail-closed 503), nginx `/healthz`,
healthcheck у всех 12 сервисов, alerter опрашивает readiness раз в 60с
(таймаут 5с). Deployed: `/health` и `/ready` 200, все контейнеры healthy
(EV-003/EV-004). Разовые тайминги EV-004 — см. latency.

## Restart — закрыто статикой

`restart: unless-stopped` 12/12; backend стартует только после healthy
db/minio/clamav/redis; alerter осознанно без `depends_on`, чтобы сообщать
об аварии, а не ждать её. Фактический рестарт в прогоне не выполнялся
(вне рамок) — время перезапуска UNKNOWN.

## Resources — наблюдение, не SLO

Конверт лимитов (static): 6.0 vCPU, 7680M памяти (EV-025). Разовый срез
EV-006: все сервисы далеко ниже лимитов (clamav ~47% — максимум).
Это одна точка во времени, а не SLO: p95/CPU-throttling/OOM-статистика —
UNKNOWN. Нагрузка не создавалась.

## Disk — частично, остаток UNKNOWN

Alerter следит за `/backups,/wal-archive` (warn 80%, critical 90%);
PG-данные 136M (EV-006). Размер и заполнение хост-диска, иноды,
рост volumes — UNKNOWN (не читались). Риск переполнения диска логами
ограничен ротацией (ниже), но не доказан наблюдением.

## Log rotation — закрыто для контейнеров, UNKNOWN для содержимого

Контейнеры: `json-file 10m × 3` у всех 12 сервисов (верхняя оценка ~360M).
Хост: `logrotate.timer` активен. Уровни/содержимое логов, ротация
внутри приложений, срок хранения — UNKNOWN (логи не читались).
Корреляция есть статически: `X-Request-ID` + 500-handler без утечек.

## Monitoring — закрыто по наличию, UNKNOWN по покрытию сигналами

Prometheus (scrape 15s, retention 15d/10GB) + Grafana (внутри сети) +
alerter + dashboard — все healthy (EV-003/EV-006). `/metrics` — только
route-шаблоны. Какие графики реально смотрят, есть ли error-budget/SLO —
UNKNOWN. См. OPS-06.

## Alerting — закрыто по механике, UNKNOWN по доставке

Alerter покрывает readiness, minio, clamd (+возраст CVD), свежесть бэкапа
(25ч), offsite-маркеры, WAL-возраст (300с), disk, replica/slot (пропуск
без реплики). Правила сверх дефолтов, каналы, факт доставки в Telegram —
UNKNOWN (значения не читались, тестового алерта не было). См. OPS-04.

## Tracing — отсутствует (static)

OTel/Sentry/распределённого трейсинга нет; только `X-Request-ID`
в логах/ответах. Межсервисной корреляции (nginx → backend → db/redis)
нет. См. OPS-06.

## Errors — механика закрыта, rates UNKNOWN

Глобальный 500-handler с `request_id`, каталог кодов `X-Error-Code`
без утечек (static). Частоты 5xx, error-budget, пороги алертов на ошибки —
UNKNOWN (окно метрик не снималось).

## Backup — четыре части разделены

- Freshness: доказана — маркеры 2026-09-21 08:03, ≥3 снапшота за день
  аудита (EV-006); порог алертера 25ч.
- Encryption: offsite-шаг защищён rclone crypt-guard (static); at-rest
  локальных снапшотов/PG-volume/MinIO-объектов не доказано — UNKNOWN,
  риск уже зафиксирован как DB-04 (дубль не создаём).
- Offsite: `BACKUP_OFFSITE_REMOTE` пуст (EV-007) — offsite-копий, скорее
  всего, нет (статус warn по контракту маркеров), содержимое маркеров
  не читалось — UNKNOWN. См. OPS-02.
- Скрипт ≠ proof: наличие `backup.sh`/`restore.sh` восстановлением не считается.

## Restore — restore proof отсутствует

`restore.sh` (sha256-предпроверка + pg_restore + MinIO-зеркало) и PITR P3
существуют статически; production restore/rehearsal не выполнялся
(вне рамок). Восстанавливаемость недоказана. См. OPS-03.

## RPO / RTO — цели, не SLA

RUNBOOK-цели: RPO ≤ 5 мин, RTO ≤ 1 ч — заявлены, но production-доказательств
нет (нужны failure drill / rehearsal-отчёт). Статус: UNKNOWN. См. OPS-04.

## CI/CD — закрыто

CI-джобы backend/frontend с аудитами, линт/типы/тесты, сборка образов,
readiness-smoke (EV-005); deploy health-gate + теги `previous` (EV-008).
Файловое событие 2026-09-17 отстаёт от running — факт для OPS-05/отчёта.

## Rollback — процедура есть, эффективность UNKNOWN

`deploy.sh rollback previous|<sha>` + сохранённые теги на хосте (EV-003).
Но: откатываются только образы, БД требует restore/PITR; процедура
в аудите не испытывалась. См. OPS-05.

## Zero-downtime — отсутствует по конструкции

Backend `replicas: 1`: выкладка останавливает единственный инстанс;
rolling/blue-green невозможен. Окно простоя при deploy — UNKNOWN
(замер не снимался). См. OPS-05.

## SPOF — главный риск контура

Всё single-node: хост, nginx, backend ×1, db-primary ×1, redis ×1,
minio ×1. Отказ любого = полная остановка; отказ диска = риск потери
данных сверх последнего снапшота (см. backup/offsite выше). См. OPS-01.

## Redis persistence — закрыто статикой, живое состояние UNKNOWN

`appendonly yes` + том `redis-prod-data` (static); наблюдение 4MiB/256MiB
(EV-006). Факт перезапуска с восстановлением, rewrite-статус — UNKNOWN.

## Redis eviction — закрыто статикой

Явная политика `maxmemory 200mb / allkeys-lru` в пределах лимита 256M
(preflight сверяет). Поведение при вытеснении SSE/rate-limit ключей
наблюдением не проверялось — UNKNOWN, риск низкий (ключи пересоздаются).

## PostgreSQL connections — закрыто статикой, живьём UNKNOWN

`max_connections=100`; пул backend 20+35=55 максимум с одного инстанса —
переполнения быть не может при `replicas: 1`. Живые counts/waits —
UNKNOWN (каталог-only правило; нагрузка не создавалась).

## Slow queries — порог есть, факты UNKNOWN

`log_min_duration_statement=500ms` (static). Реестры идут в Primary;
фактических slow-логов, планов, N+1 в проде — UNKNOWN (логи/EXPLAIN
на проде не снимались; нагрузка не создавалась).

## Locks — механика закрыта, живьём UNKNOWN

`backup-lock.py` (коды 0/1/2/3), advisory lock миграций, репликационных
слотов нет (P1: `REPL_SLOT` пуст). Живые ожидания блокировок — UNKNOWN.

## Queues — durable-очередей нет (static)

Celery/Dramatiq/ARQ отсутствуют; фон — cron backup-timer, 60с-цикл
wal-offsite, 60с-цикл alerter, SSE-ticket TTL 30с. Потерянные задачи
между рестартами не персистятся (кроме WAL/minio-данных) — принято
конструкцией single-node.

## Retries — частично

Повторы есть у healthcheck'ов, `wait_for_healthy`, alerter-дедупликации
с эскалацией warning→critical; app-level retry/backoff/circuit-breaker
для внешних вызовов — UNKNOWN в этом тикете (контур AI-тикетирован
отдельно, T07).

## DLQ — отсутствует по конструкции

Без durable-очередей мёртвым письмам негде накапливаться: недоставленный
алерт дедуплицируется в `/state`, неотправленный WAL/offsite виден
маркерами возраста. Отдельного DLQ-механизма нет — не дефект, а свойство;
риск покрыт OPS-04 (наблюдаемость доставки).

## Latency — только разовые наблюдения, не SLO

EV-004 (по одному GET): health 0.95с, ready 0.69с, landing 1.22с —
точки, а не SLO; p50/p95/география/деградация под нагрузкой — UNKNOWN.
Историческая статическая пометка: фронт поднят до 1.25 CPU после того,
как SSR p95 упирался в CPU (комментарий compose) — прошлое наблюдение
разработчиков, не текущий замер. Нагрузка в этом тикете не создавалась.

## Single-node vs цель 2× Dell R640

| Аспект | Сейчас (факт) | Цель 2× R640 (рамка spec) | Разрыв |
|---|---|---|---|
| Хосты | 1 узел, uptime 5 дней | 2 сервера с отказоустойчивостью | Нет host-redundancy — OPS-01 |
| Backend | ×1, rolling невозможен | ≥×2 за балансировщиком | Нет zero-downtime — OPS-05 |
| PostgreSQL | только Primary, replica `not_configured` | streaming-replica + failover | Нет failover; PITR только из снапшотов — DB-05/OPS-03 |
| Redis/MinIO | ×1 на том же хосте | распределённо/реплицировано | Общая судьба с хостом — OPS-01 |
| Offsite | remote пуст | offsite-копии + drill | Нет копий вне хоста — OPS-02 |
| RPO/RTO | цели без proof | доказанные drill'ами | UNKNOWN — OPS-04 |
| Наблюдаемость | prometheus/grafana/alerter healthy | SLO/error-budget/on-call drill | Нет SLO/tracing-proof — OPS-06 |

Текущий контур — рабочий single-node P1 без SLA; целью он не является
(spec: оценивается как факт, а не как цель). Преждевременная публикация
цели как достигнутой была бы finding'ом — не публикуем.

## UNKNOWN и недостающие доказательства

- Живые DB-internals (connections/slow/locks), рост диска, содержимое логов
- Факт доставки алертов, покрытие сигналами, error-budget/SLO
- Offsite-копии (содержимое маркеров), at-rest шифрование (см. DB-04)
- RPO/RTO-proof, restore rehearsal, время рестарта/простоя deploy
- Ролевой runtime (R36, до test accounts), TLS-сертификаты (не в зоне)
- Всё выше — честный UNKNOWN, а не догадка
