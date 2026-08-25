# Деплой платформы «Технозрелость» (production)

Стек: **Docker Compose** — nginx (балансировщик), frontend (Next.js 16), backend (FastAPI, 2 реплики), PostgreSQL Primary/Replica (pgvector), MinIO, ClamAV, Redis.

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
- **Health/readiness**: у всех сервисов healthcheck; backend использует
  `/api/v1/ready` — реальные соединения Primary и Replica.
- **Миграции без гонок**: входная точка контейнера (`infra/backend-entrypoint.sh`)
  ждёт Primary и применяет `alembic upgrade head` под pg advisory lock — при
  старте нескольких реплик миграцию выполнит ровно один контейнер.
- **Секреты — только через env** (`.env.production`, в `.gitignore`); данные —
  в named volumes, повторный запуск идемпотентен.

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

# 3. Запустить (одна команда)
./infra/deploy.sh
```

## Проверка

```bash
curl -sk https://localhost/api/v1/health       # {"status":"ok",...} (HTTP отвечает 301 → HTTPS)
curl -sk https://localhost/api/v1/ready       # readiness: primary+replica {"status":"ready",...}
docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml ps   # все сервисы healthy
```

Требуемые свободные порты хоста: **80, 443** (nginx), **3001** (Grafana).
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
