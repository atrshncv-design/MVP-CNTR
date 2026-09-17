# Деплой платформы «Технозрелость» (production)

Стек: **Docker Compose** — nginx, frontend (Next.js 16), backend (FastAPI, 1 реплика), PostgreSQL Primary (pgvector, единственная БД), MinIO, ClamAV, Redis, ежедневный backup-timer и Telegram-алертер.

## Одноузловой контур P1

`docker-compose.prod.yml` реализует production-контур P1 (один узел, без SLA):

- **Один backend** (`deploy.replicas: 1`); nginx обращается по сервисному
  имени `backend:8000`.
- **Только Primary**: `db` — запись и чтение. Replica нет по проекту;
  backend читает реестры/каталоги (`/projects/registry`, `/executors/*`,
  `/nioktr*`) через Primary, `/api/v1/ready` отдаёт
  `{"primary": "ok", "replica": "not_configured"}`.
  Роль REPLICATION сохраняется для physical pg_basebackup; слота репликации
  нет (REPL_SLOT пуст).
- **Health/readiness**: healthcheck и health-gate применяются к сервисам
  `db`, `minio`, `clamav`, `redis`, `backend`, `backup-timer`,
  `wal-offsite`, `alerter`, `frontend`, `nginx`, `prometheus` и `grafana`; backend использует
  `/api/v1/ready` — реальное соединение Primary.
- **Миграции без гонок**: входная точка контейнера (`infra/backend-entrypoint.sh`)
  ждёт Primary и применяет `alembic upgrade head` под pg advisory lock.
  Перед ней `backup-lock.py` использует отдельный non-blocking lock, а
  `BACKUP_RUN_ID` из image tag не даёт рестарту повторить уже успешный
  pre-migration backup той же выкладки.
- **Секреты — только через env** (`.env.production`, в `.gitignore`); данные —
  в named volumes, повторный запуск идемпотентен.
- **Health-gate и rollback**: backend/frontend получают тег текущего git SHA;
  deploy.sh сохраняет работающие образы под тегом `previous`, ждёт healthy
  перечисленных выше сервисов и `/api/v1/ready`, а при провале перевыкатывает
  `previous` и возвращает ненулевой код.
- **Проверка sidecar-ов**: `backup-timer`, `wal-offsite` и `alerter` входят в
  `HEALTH_SERVICES`; их container healthcheck подтверждает живой PID 1 через
  `kill -0` и наличие
  встроенной команды из production image. Дополнительно команды, env и volumes проверяются
  через `docker compose --env-file infra/.env.production -f
  infra/docker-compose.prod.yml config`; для алертера используется безсетевой
  `run --rm --no-deps alerter python /usr/local/bin/tz-alerter.py --self-check`,
  а для таймера — `sh -n infra/cron/backup-timer.sh` и
  `BACKUP_TIMER_SELF_CHECK=1 sh infra/cron/backup-timer.sh`: проверяются наличие
  скрипта и ближайший target без ожидания суток.
  Режим `BACKUP_TIMER_RUN_ONCE=1` выполняет реальный бэкап как отдельный
  smoke-тест.
- **Наблюдаемость**: alerter проверяет readiness, Primary,
  health MinIO (`ALERTER_MINIO_HEALTH_URL`), PING/PONG доступность ClamAV
  (`ALERTER_CLAMAV_HOST`/`ALERTER_CLAMAV_PORT`), маркеры backup/offsite и
  заполнение томов. Проверок Replica/слота нет (реплики нет по проекту).
  Без `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` он пишет
  предупреждение и безопасно работает без отправки.
- **Rollback без текущего app source**: backup, restore, timer, WAL-offsite,
  crypt-guard, lock-runner и alerter поставляются внутри backend image и также
  монтируются как явные operational scripts в стабильные `/usr/local/bin/tz-*`
  paths. Это intentional compatibility layer для `rollback --no-build`: старый
  image не обязан содержать новые скрипты. App source bind mounts запрещены.
  Исторические bind mounts конфигурации, init- и entrypoint-скриптов PostgreSQL
  сохраняются отдельно и требуют проверки при rollback.

## Ресурсный конверт P1 (таск 04, R01/G15/G42)

Целевая машина: **6 vCPU / 11 ГиБ RAM / 150 ГБ SSD**. Каждый долгоживущий
сервис имеет жёсткие лимиты CPU/RAM в `docker-compose.prod.yml` (`deploy.resources.limits`,
видны в инспекте контейнеров). Гейт `preflight.py` (вызывается из `deploy.sh`
до сборки и миграций) отклоняет машину слабее цели и бюджет сверх потолка.

| Сервис | CPU | RAM | Трассировка |
|---|---|---|---|
| PostgreSQL Primary | 1.0 | 1536M | единственная БД контура; крупнейшая доля локального замера стенда ~1,55 ГиБ RAM |
| Backend FastAPI ×1 | 1.0 | 1536M | образ ~682 МБ распакованным (Python, зависимости, seed-файлы) + рабочий запас |
| ClamAV | 1.0 | 2048M | 1–2 ГиБ по проекту: локальный замер 7 МиБ снят с нездорового демона и нерепрезентативен; базы сигнатур целиком в памяти |
| Frontend Next.js | 0.75 | 768M | SSR кабинетов; пик сборки ~2 ГБ покрывается запасом вне лимитов (см. ниже) |
| MinIO | 0.5 | 384M | файлы проектов; рост 100 МБ новых файлов/день идёт в диск, а не в RAM |
| Redis | 0.25 | 256M | rate-limit/SSE; `maxmemory 200mb` + `allkeys-lru` внутри лимита контейнера |
| Prometheus | 0.5 | 384M | ретеншн ограничен: время `15d` и размер `10GB` |
| Grafana | 0.25 | 256M | только по SSH-туннелю, вне публики |
| nginx | 0.25 | 128M | точка входа TLS |
| Alerter | 0.1 | 128M | пробы readiness/диска/маркеров |
| Backup-timer | 0.25 | 128M | суточный снапшот вне пика |
| Wal-offsite | 0.15 | 128M | отправка WAL каждые 60 секунд |
| **Сумма** | **6.0** | **7680M = 7.5 ГиБ ≤ 8 ГиБ** | остаток 11 ГиБ — ОС, Docker и кратковременный пик сборки |

Диск 150 ГБ (Решения §4, история 1/R01) из расчёта 100 МБ новых файлов/день
(история 23/G15): ~37 ГБ файлов за 12 месяцев
(G15, без автоудаления — G16) + локальные снапшоты, WAL-архив, мониторинг,
образы и кэш сборки в одном бюджете; preflight требует не менее 60 ГБ
свободного места до выкладки (тот же родитель: Решения §4, история 1/R01). Норматив пилота P1 — эта таблица
(фактический сервер 6/11/150); `docs/СЕРВЕР-ТРЕБОВАНИЯ.md` описывает
прежнюю оценку и обновляется отдельно. Предел контура (нагрузочный гейт, таск 10):
50 concurrent, ≥99% успеха, API p95 ≤1с, страницы ≤2с, RAM <80%.

## Требования
- Канонические production-требования P1 (история 1/R01, Решения §4): **6 vCPU / 11 ГиБ RAM / 150 ГБ SSD** — норматив пилота, таблица «Ресурсный конверт P1» выше; preflight отклоняет машину слабее цели до сборки. Прежняя оценка из [`docs/СЕРВЕР-ТРЕБОВАНИЯ.md`](../../docs/СЕРВЕР-ТРЕБОВАНИЯ.md) отозвана как недоказуемая и целью не является (файл обновляется отдельно).
- Linux-сервер (Ubuntu/Debian рекомендуются) и Docker + Docker Compose v2.
- macOS с Docker Desktop пригоден только для локальной проверки, не для production capacity.

> Этот runbook описывает конфигурацию. Успешный local/compose check не является
> подтверждением production deploy, offsite/PITR, Telegram delivery или rollback;
> для них нужны операторские remote/config и production-like capacity.

## Шаги (15 минут)

```bash
# 1. Скопировать репозиторий на сервер и перейти в backend
git clone https://github.com/atrshncv-design/MVP-CNTR.git
cd MVP-CNTR/technozrelost-backend

# 2. Подготовить окружение
cp infra/.env.production.example infra/.env.production
#    — заполнить POSTGRES_PASSWORD, REPL_PASSWORD, MINIO_SECRET_KEY,
#      NEXTAUTH_URL, CORS_ORIGINS, GRAFANA_ADMIN_PASSWORD
#    — JWT_SECRET / NEXTAUTH_SECRET сгенерируются автоматически при деплое;
#      заданные вручную должны быть случайными и не короче 32 символов

# 3. Запустить (одна команда; пароль Grafana обязателен и не может быть admin)
./infra/deploy.sh
```

## Проверка

```bash
curl https://1-2-3-4.sslip.io/api/v1/health       # {"status":"ok",...} (HTTP отвечает 301 → HTTPS)
curl https://1-2-3-4.sslip.io/api/v1/ready       # readiness: {"status":"ready","databases":{"primary":"ok","replica":"not_configured"},...}
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml ps   # все сервисы health-gate healthy
```

Проверка идёт верифицированным HTTPS публичного хоста (без `-k`);
`1-2-3-4.sslip.io` — пример, подставьте `PUBLIC_HOST` сервера.

Требуемые свободные порты хоста: **80, 443** (nginx). БД, MinIO, Prometheus и
Grafana наружу не публикуются — только внутри сети compose. Production Compose
фиксирует subnet `172.30.0.0/24` и монтирует только строгий
`postgres/pg_hba.conf`: app и replication доступны с этого CIDR по
`scram-sha-256`. В production нет ни опубликованного PostgreSQL-порта, ни
правила Docker Desktop gateway.

Dev Compose использует отдельные `172.31.0.0/24` (`tz-dev-network`) и
`postgres/pg_hba.dev.conf`. В последнем есть ограниченное `scram-sha-256`
правило `192.168.65.0/24` только для Docker Desktop for Mac: соединение host с
опубликованным `localhost:5432`/`localhost:5433` PostgreSQL видит как gateway
`192.168.65.1`, а не как `127.0.0.1`. Это dev-only исключение не переносится в
production Compose и не является разрешением произвольной Docker-сети.

Старую автоматически созданную сеть `technozrelost-infra_default` с другим CIDR
не меняйте на месте. Из `technozrelost-backend/` безопасно пересоздайте только
dev-контейнеры БД:

```bash
docker compose -f infra/docker-compose.yml up -d --force-recreate pg-primary pg-replica
```

Команда сохраняет named volumes; не используйте `down -v` и не удаляйте volumes
или images. Не запускайте dev и production Compose с пересекающимися subnet на
одном Docker host и меняйте subnet только вместе с соответствующим HBA-файлом.

Dev-значение `REPL_PASSWORD` по умолчанию едино для primary и replica. Оно
заменило прежнее значение по умолчанию, поэтому существующий dev-volume не
следует считать совместимым с сохранённым старым credential. При каждом старте
primary до healthcheck идемпотентно устанавливает credential из текущего
`REPL_PASSWORD`, проверяет SCRAM-вход этой ролью и только затем разрешает старт
replica. Для важного dev-volume задайте явный `REPL_PASSWORD` перед командой
recreate; production default отсутствует и переменная обязательна.

## Ручной rollback

После успешной выкладки предыдущие backend/frontend образы сохраняются под
локальным тегом `previous`. Откатить стек и снова пройти health-gate:

```bash
./infra/deploy.sh rollback previous
# либо на конкретный сохранённый SHA:
./infra/deploy.sh rollback <git-sha>
```

При необходимости увеличить окно проверки: `DEPLOY_HEALTH_TIMEOUT_SECONDS=600
./infra/deploy.sh rollback previous`. Команда не удаляет named volumes и не
пропускает строгую проверку пароля Grafana.

Откат с учётом БД: rollback перевыкатывает только образы backend/frontend и
снова проходит health-gate (включая счётчик backend `BACKEND_EXPECTED_REPLICAS=1`);
миграции Alembic вперёд-совместимы и вниз не откатываются, данные в named volumes
сохраняются. Если выкладка успела применить миграцию, ломающую схему, отката образов
недостаточно — восстанавливайте данные из снапшота по RUNBOOK-DATA.md P2 (только
в пустую БД, с проверкой SHA256SUMS до любых изменений) либо выполняйте PITR по P3.

Operational scripts для rollback монтируются из `infra/` read-only; перед
откатом checkout и `.env.production` должны соответствовать текущему runbook.
Это не mount исходников приложения.

## Доступ к Grafana

Grafana слушает только внутренний порт compose. На сервере сначала получить IP
контейнера, затем открыть туннель с локальным портом:

```bash
GRAFANA_IP="$(ssh ops@server 'docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" tz-prod-grafana')"
ssh -N -L 3001:"$GRAFANA_IP":3000 ops@server
```

После этого панель открывается на `http://localhost:3001`; логин и пароль берутся
из `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` на сервере.

## Telegram и пороги алертера

В `.env.production` задаются только имена переменных и значения владельца:
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Дополнительные параметры:
`ALERTER_INTERVAL_SECONDS`, `ALERTER_READINESS_URL`,
`ALERTER_MINIO_HEALTH_URL`, `ALERTER_CLAMAV_HOST`, `ALERTER_CLAMAV_PORT`,
`ALERTER_DISK_WARN_PERCENT`, `ALERTER_DISK_CRITICAL_PERCENT`,
`ALERTER_SLOT_LAG_WARN_BYTES`, `ALERTER_SLOT_LAG_CRITICAL_BYTES` и
`ALERTER_REPLICA_LAG_CRITICAL_BYTES`. Состояние дедупликации хранится в named
volume `alerter-state-prod-data`; активная авария даёт одно сообщение, затем —
одно сообщение восстановления.
БД и MinIO наружу не публикуются — только внутри сети compose.

## Offsite через rclone

При пустом `BACKUP_OFFSITE_REMOTE` offsite остаётся warn/no-op, а пустой config
volume не блокирует запуск. При заданном remote production image содержит
multi-arch distro `rclone`; `backup-timer` и `wal-offsite` читают
`/rclone-config/rclone.conf` из read-only named volume `tz-prod-rclone-config`.
Перед копированием `backup.sh` без вывода конфигурации проверяет, что имя до
первого `:` ссылается на remote `type = crypt`; `no_data_encryption = true`,
`1`, `yes` или `on` в любом регистре, а также обычный storage remote отвергаются,
маркер получает `fail`, plaintext-копии не будет.

1. На защищённой машине, не в репозитории, настроить storage remote и отдельный
   crypt remote, оборачивающий нужный bucket/path. В `BACKUP_OFFSITE_REMOTE`
   указывается `crypt-remote:path`, а не underlying storage remote. Локально
   проверить тип remote без передачи или публикации вывода конфигурации.
2. Создать volume и загрузить файл с правами владельца:

```bash
docker volume create tz-prod-rclone-config
docker run --rm -i --mount type=volume,src=tz-prod-rclone-config,dst=/config \
  alpine:3.20 sh -c 'umask 077; cat > /config/rclone.conf' \
  < /secure/path/rclone.conf
```

`/secure/path/rclone.conf` — локальный файл оператора, он не коммитится и не
монтируется в production-контейнер. После заполнения перезапустить sidecar-ы:

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml \
  up -d --no-build backup-timer wal-offsite
```

При заданном remote healthcheck обоих sidecar-ов дополнительно проверяет наличие
config, тип `crypt` и отсутствие truthy `no_data_encryption`; при пустом remote эта проверка
пропускается. Plain remote будет отмечен как `fail` и не получит ни одного объекта.
`backup-timer` ежедневно копирует снапшот в `<remote>/<UTC-TIMESTAMP>`, а
`wal-offsite` каждые 60 секунд копирует новые WAL и завершённые timeline history-файлы
в `<remote>/wal-archive`, а после успешной отправки удаляет только их старше
`WAL_ARCHIVE_KEEP_DAYS`. Скрытые, временные и частичные файлы не копируются и не
удаляются. До появления первого архивного объекта он пишет `warn no-wal`, а не `ok`.
Состояния видны в `/backups/.offsite-status` и `/backups/.wal-offsite-status`.

## Наполнение данными (разово, после первого запуска)

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml exec backend sh -c \
  "python -m app.db.seed_gost && python -m app.db.seed_nioktr && python -m app.db.seed_templates"
```

- `seed_gost` — ГОСТы из папки «ГОСТЫ» (копируются в образ при сборке; пересборка после добавления файлов)
- `seed_nioktr` — НИОКТР из `data/nioktr_all.json` (копируется в образ, см. Dockerfile)
- `seed_templates` — шаблоны документов ТЗ/Паспорт/ТЭО

## HTTPS через sslip.io (таск 07, G40/G41)

Постоянного домена нет: публичный MVP живёт на техническом имени
`<ipv4>.sslip.io` (пример: `1-2-3-4.sslip.io`) с доверенным ACME-сертификатом.
HTTP редиректит на HTTPS (кроме `/.well-known/acme-challenge/` и `/healthz`).

```bash
# 0. На сервере заполнить PUBLIC_HOST и ACME_EMAIL в infra/.env.production
# 1. Первичный выпуск (порт 80 свободен, nginx ещё не поднят):
./infra/tls_issue.sh
# 2. Деплой: TLS-гейт (SAN, годность, https-URL, CORS) проходит до сборки,
#    финальный health-гейт — верифицированным HTTPS без -k:
./infra/deploy.sh
# Проверка:
curl https://1-2-3-4.sslip.io/api/v1/health
curl https://1-2-3-4.sslip.io/api/v1/ready
```

Строгий гейт `infra/tls_deploy_gate.py` роняет выкладку (вместо молчаливого
самоподписанного fallback) при: localhost в `PUBLIC_HOST`/`NEXTAUTH_URL`/`CORS_ORIGINS`,
`NEXTAUTH_URL` не `https://<PUBLIC_HOST>`, отсутствии `https://<PUBLIC_HOST>`
в `CORS_ORIGINS` или http-ориджинах, отсутствии файлов сертификата,
SAN без `PUBLIC_HOST`, самоподписанном сертификате, годности менее
`TLS_MIN_VALIDITY_DAYS` (дефолт 14 дней; менее 30 дней — предупреждение).

Продление без просадки readiness — `infra/tls_renew.sh` (webroot, nginx
перезагружается reload только при смене пары, затем гейт и верифицированный
проб). Dry-run для приёмки: `./infra/tls_renew.sh --dry-run`. На сервере —
ежедневный cron: `0 4 * * * cd <repo>/technozrelost-backend/infra && ./tls_renew.sh`.
Состояние ACME — в docker volume `tz-prod-certbot-conf` (ключи не в git).

### Свой домен вместо sslip.io (R08, таск 07)

Причина: репутационные фильтры мобильных операторов к wildcard-DNS —
с телефонов платформа без VPN открывается только на собственном имени.
Покупка имени — за владельцем; полная инструкция для него (купить →
вписать → сообщить → перезапуск) — `infra/README-OWN-DOMAIN.md`.
Операторская часть — тем же процессом, без правок кода:

```bash
# .env.production уже заполнен владельцем: PUBLIC_HOST=<новое имя>,
# NEXTAUTH_URL/CORS_ORIGINS — то же имя, LEGACY_PUBLIC_HOST=<старое имя>
./infra/tls_issue.sh   # сертификат сразу на оба имени (SAN новое + старое)
./infra/deploy.sh      # гейт обоих имён → рендер 301 → health-гейт
# Проверка:
curl https://<новое-имя>/api/v1/health
curl -I https://<старое-имя>/api/v1/health   # 301 Location: https://<новое-имя>/...
```

Переключение адресов — значением `PUBLIC_HOST` (плюс те же имя
в `NEXTAUTH_URL`/`CORS_ORIGINS`); `deploy.sh` после гейта генерирует
`nginx/legacy/redirect.conf` (301 со старого на новое, HTTP и HTTPS;
HTTP-01 challenges старого имени продолжают отдаваться для продления).
Гейт принимает оба формата имён, плейсхолдер `vash-domen.ru` отклоняет,
SAN без старого имени при заданном `LEGACY_PUBLIC_HOST` — провал
вместо предупреждения браузера о чужом сертификате. Когда старое имя
больше не нужно — убрать `LEGACY_PUBLIC_HOST` и перезапустить.

## Секреты и безопасность

- `JWT_SECRET`, `NEXTAUTH_SECRET` — при пустом значении или `change_me*` генерируются
  автоматически как 256-bit случайные hex-токены. Непустые operator-supplied значения
  должны быть не placeholder, не короче 32 символов, без whitespace и с минимум восемью
  различными символами; слабое значение останавливает deploy без вывода значения.
- `LLM_API_KEY` — кладёт Functional Validator (ключ opencode zen, free-модели).
- `.env` и `infra/.env.production` — в `.gitignore`, никогда не коммитить.
