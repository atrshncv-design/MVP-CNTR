# Деплой платформы «Технозрелость» (production)

Стек: **Docker Compose** — nginx (балансировщик), frontend (Next.js 16), backend (FastAPI, 2 реплики), PostgreSQL Primary/Replica (pgvector), MinIO, ClamAV, Redis, ежедневный backup-timer и Telegram-алертер.

## Масштабируемый контур (тикет 18)

`docker-compose.prod.yml` реализует production-контур по спеке §7.4:

- **App-слой stateless**: backend масштабируется репликами (`deploy.replicas: 2`);
  nginx балансирует через Docker DNS (upstream `backend:8000`, round-robin).
  Изменить число реплик: `docker compose ... up -d --scale backend=N`.
- **Primary/Replica**: `db` (Primary) — единственная точка записи; `db-replica`
  (hot standby) — безопасные чтения. Backend направляет реестры/каталоги
  (`/projects/registry`, `/executors/*`, `/nioktr*`) на replica, если задан
  `POSTGRES_REPLICA_HOST` (или полный `DATABASE_REPLICA_URL`). Read-after-write
  (создание/мутация проекта и т.п.) всегда идёт в Primary.
- **Health/readiness**: healthcheck и health-gate применяются к сервисам
  `db`, `db-replica`, `minio`, `clamav`, `redis`, `backend`, `backup-timer`,
  `wal-offsite`, `alerter`, `frontend`, `nginx`, `prometheus` и `grafana`; backend использует
  `/api/v1/ready` — реальные соединения Primary и Replica.
- **Миграции без гонок**: входная точка контейнера (`infra/backend-entrypoint.sh`)
  ждёт Primary и применяет `alembic upgrade head` под pg advisory lock — при
  старте нескольких реплик миграцию выполнит ровно один контейнер. Перед ней
  `backup-lock.py` использует отдельный non-blocking lock, а `BACKUP_RUN_ID` из
  image tag не даёт второй реплике повторить уже успешный pre-migration backup.
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
- **Наблюдаемость**: alerter проверяет readiness, Primary/Replica и replication
  slot, health MinIO (`ALERTER_MINIO_HEALTH_URL`), PING/PONG доступность ClamAV
  (`ALERTER_CLAMAV_HOST`/`ALERTER_CLAMAV_PORT`), маркеры backup/offsite и
  заполнение томов. Без `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` он пишет
  предупреждение и безопасно работает без отправки.
- **Rollback без текущего app source**: backup, restore, timer, WAL-offsite,
  crypt-guard, lock-runner и alerter поставляются внутри backend image и также
  монтируются как явные operational scripts в стабильные `/usr/local/bin/tz-*`
  paths. Это intentional compatibility layer для `rollback --no-build`: старый
  image не обязан содержать новые скрипты. App source bind mounts запрещены.
  Исторические bind mounts конфигурации, init- и entrypoint-скриптов PostgreSQL
  сохраняются отдельно и требуют проверки при rollback.

## Требования
- Канонические production-требования: [`docs/СЕРВЕР-ТРЕБОВАНИЯ.md`](../../docs/СЕРВЕР-ТРЕБОВАНИЯ.md): минимум 4 vCPU, 12 GB RAM и 500 GB SSD/NVMe.
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
curl -sk https://localhost/api/v1/health       # {"status":"ok",...} (HTTP отвечает 301 → HTTPS)
curl -sk https://localhost/api/v1/ready       # readiness: primary+replica {"status":"ready",...}
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml ps   # все сервисы health-gate healthy
```

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

## HTTPS

По умолчанию deploy.sh генерирует **самоподписанный** сертификат. Для настоящего HTTPS:

1. Настроить DNS: A-запись домена на IP сервера.
2. Выпустить сертификат (certbot в docker или на хосте) для `NEXTAUTH_URL`.
3. Положить `fullchain.pem` / `privkey.pem` в `infra/nginx/certs/`.
4. `docker compose -f infra/docker-compose.prod.yml restart nginx`

## Секреты и безопасность

- `JWT_SECRET`, `NEXTAUTH_SECRET` — при пустом значении или `change_me*` генерируются
  автоматически как 256-bit случайные hex-токены. Непустые operator-supplied значения
  должны быть не placeholder, не короче 32 символов, без whitespace и с минимум восемью
  различными символами; слабое значение останавливает deploy без вывода значения.
- `LLM_API_KEY` — кладёт Functional Validator (ключ opencode zen, free-модели).
- `.env` и `infra/.env.production` — в `.gitignore`, никогда не коммитить.
