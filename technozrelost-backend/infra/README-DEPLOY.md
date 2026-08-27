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
  `db`, `db-replica`, `minio`, `clamav`, `redis`, `backend`, `frontend`, `nginx`,
  `prometheus` и `grafana`; backend использует `/api/v1/ready` — реальные
  соединения Primary и Replica.
- **Миграции без гонок**: входная точка контейнера (`infra/backend-entrypoint.sh`)
  ждёт Primary и применяет `alembic upgrade head` под pg advisory lock — при
  старте нескольких реплик миграцию выполнит ровно один контейнер.
- **Секреты — только через env** (`.env.production`, в `.gitignore`); данные —
  в named volumes, повторный запуск идемпотентен.
- **Health-gate и rollback**: backend/frontend получают тег текущего git SHA;
  deploy.sh сохраняет работающие образы под тегом `previous`, ждёт healthy
  перечисленных выше сервисов и `/api/v1/ready`, а при провале перевыкатывает
  `previous` и возвращает ненулевой код.
- **Проверка sidecar-ов**: `backup-timer` и `alerter` намеренно не входят в
  `HEALTH_SERVICES` и не имеют container healthcheck. Их команды, env и volumes
  проверяются через `docker compose --env-file infra/.env.production -f
  infra/docker-compose.prod.yml config`; для алертера дополнительно
  используется безсетевой `run --rm --no-deps alerter python
  /app/infra/alerter/alerter.py --self-check`, а для таймера — `sh -n
  infra/cron/backup-timer.sh` (режим `BACKUP_TIMER_RUN_ONCE=1` выполняет
  реальный бэкап и не является частью health-gate).
- **Наблюдаемость**: alerter проверяет readiness, Primary/Replica и replication
  slot, маркеры backup/offsite и заполнение томов. Без `TELEGRAM_BOT_TOKEN` и
  `TELEGRAM_CHAT_ID` он пишет предупреждение и безопасно работает без отправки.

## Требования
- Linux-сервер (Ubuntu/Debian рекомендуются) или macOS с Docker Desktop
- Docker + Docker Compose v2
- 4+ ГБ RAM, 10+ ГБ диска

## Шаги (15 минут)

```bash
# 1. Скопировать репозиторий на сервер и перейти в backend
git clone https://github.com/atrshncv-design/MVP-CNTR.git
cd MVP-CNTR/technozrelost-backend

# 2. Подготовить окружение
cp infra/.env.production.example infra/.env.production
#    — заполнить POSTGRES_PASSWORD, REPL_PASSWORD, MINIO_SECRET_KEY,
#      NEXTAUTH_URL, CORS_ORIGINS, GRAFANA_ADMIN_PASSWORD
#    — JWT_SECRET / NEXTAUTH_SECRET сгенерируются автоматически при деплое

# 3. Запустить (одна команда; пароль Grafana обязателен и не может быть admin)
./infra/deploy.sh
```

## Проверка

```bash
curl -sk https://localhost/api/v1/health       # {"status":"ok",...} (HTTP отвечает 301 → HTTPS)
curl -sk https://localhost/api/v1/ready       # readiness: primary+replica {"status":"ready",...}
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml ps   # сервисы health-gate healthy; sidecar-ы проверяются отдельно
```

Требуемые свободные порты хоста: **80, 443** (nginx). БД, MinIO, Prometheus и
Grafana наружу не публикуются — только внутри сети compose.

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
`ALERTER_DISK_WARN_PERCENT`, `ALERTER_DISK_CRITICAL_PERCENT`,
`ALERTER_SLOT_LAG_WARN_BYTES`, `ALERTER_SLOT_LAG_CRITICAL_BYTES` и
`ALERTER_REPLICA_LAG_CRITICAL_BYTES`. Состояние дедупликации хранится в named
volume `alerter-state-prod-data`; активная авария даёт одно сообщение, затем —
одно сообщение восстановления.
БД и MinIO наружу не публикуются — только внутри сети compose.

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

- `JWT_SECRET`, `NEXTAUTH_SECRET` — генерируются автоматически; перезапись ломает сессии (это нормально при первом деплое).
- `LLM_API_KEY` — кладёт Functional Validator (ключ opencode zen, free-модели).
- `.env` и `infra/.env.production` — в `.gitignore`, никогда не коммитить.
