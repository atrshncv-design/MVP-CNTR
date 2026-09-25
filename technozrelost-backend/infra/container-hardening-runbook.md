# T13 — runbook least-privilege hardening контейнеров

**Статус:** конфигурация подготовлена и проверена статически; применение к
production не разрешено этим тикетом. В тикете нет запуска, сборки или pull
контейнеров, изменения production, миграций и операций с данными.

## Область и решение

Политика одинакова для dev и prod: совместимые процессы получают числовой
непривилегированный UID/GID, `cap_drop: [ALL]`, `no-new-privileges:true` и
`read_only: true`. Временные файлы и кэши явно перечислены в `tmpfs`; постоянные
данные остаются в named volumes или read-only bind mounts. В Compose нет
`privileged: true` и широких `cap_add`.

Пользователь backend/frontend (`10001:10001`) создаётся в Dockerfile, а
`/app` и writable runtime-каталоги передаются ему на этапе сборки. Это не
обход через root: Compose не меняет пользователя командой и не требует
`chown` при каждом старте. Перед первым production-применением владелец должен
проверить ownership уже созданных named volumes отдельной разрешённой процедурой;
эта процедура не входит в T13.

## Реестр исключений

Исключения не считаются общим `PASS`: для них намеренно не заявляется
non-root/`cap_drop ALL`. Тем не менее `no-new-privileges` и read-only rootfs
оставлены, а writable surface ограничен явными томами/tmpfs.

| Сервис(ы) | Точная причина root/entrypoint | Writable surface | Компенсирующая изоляция |
|---|---|---|---|
| `db`, `pg-primary`, `pg-replica` | Официальный PostgreSQL entrypoint инициализирует кластер, меняет ownership и выполняет privilege drop через root; нужны недоказанные здесь `CHOWN`/`SETUID`/`SETGID`. | PGDATA и WAL archive — named volumes; `/tmp` и `/var/run/postgresql` — tmpfs. Конфиги и HBA — `:ro`. | `no-new-privileges`, read-only rootfs, healthcheck, отдельные Compose-сети; production Primary не публикует порт. До смены образа/entrypoint non-root не заявляется. |
| `clamav` (dev: `mkodockx/docker-clamav:alpine`) | Dev Compose явно ссылается на этот image, а prod Compose — на отдельный pinned image `clamav/clamav:1.4.3`. Это единственное подтверждение, взятое здесь из исходников: image metadata, entrypoint и наблюдение runtime UID/GID/capabilities не выполнялись. Поэтому утверждение о конкретном entrypoint, root, chown или privilege drop не делается: эти характеристики — `UNKNOWN` до отдельного разрешённого staging-запуска. | `/var/lib/clamav` — named volume; `/tmp`, `/var/run/clamav`, `/var/log/clamav` — tmpfs. В dev порт `3310` опубликован намеренно. | `no-new-privileges`, read-only rootfs, healthcheck; до подтверждения runtime-поведения сервис не объявляется non-root/cap-drop PASS. |
| `clamav` (prod: `clamav/clamav:1.4.3@sha256:75fb5fd95fcbe1d7e6d240c369c1572b686ee2c95949d1042b5148de8eddebb4`) | В prod Compose статически закреплён этот pinned image, volume, tmpfs и healthcheck. Без разрешённого контейнерного запуска не подтверждены фактические entrypoint, UID/GID, capabilities и наличие privilege drop; root-требование не заявляется, runtime-поведение — `UNKNOWN`. | `/var/lib/clamav` — named volume; `/tmp`, `/var/run/clamav`, `/var/log/clamav` — tmpfs. | `no-new-privileges`, read-only rootfs, healthcheck, внутренняя сеть; production порт не публикуется. |
| `nginx` | Официальный entrypoint поднимает сервис на 80/443 и управляет pid/cache/log; rootless запуск потребовал бы смены образа/конфигурации, не входит в T13. | `/var/cache/nginx`, `/var/run`, `/var/log/nginx`, `/tmp` — tmpfs; конфиг, сертификаты и ACME webroot — read-only mounts. | `no-new-privileges`, read-only rootfs, только edge network и healthcheck; новые capabilities не добавляются. |

`minio`, `redis`, `prometheus`, `grafana` и все четыре custom-image сервиса
(`backend`, `backup-timer`, `wal-offsite`, `alerter`) не входят в этот реестр:
для них в Compose явно задан числовой пользователь и `cap_drop: [ALL]`.
Поведение образа с неподтверждённым runtime-контрактом не маскируется: перед
production нужен отдельный staging rehearsal, иначе сервис считается `BLOCKED`.

## Предварительные условия

1. Работа выполняется только в изолированной копии/staging среды; T13 не
   запускает контейнеры и не применяет Compose к production.
2. На машине есть Docker Compose v2 только для `config --quiet`; команды
   ниже используют `COMPOSE_DISABLE_ENV_FILE=1` и только синтетические
   placeholder-значения, переданные inline.
3. Не читать и не выводить environment files, ключи, cookies, токены или
   credential stores. В отчёте фиксируются только имена переменных.
4. До будущего production change plan должен иметь отдельное разрешение,
   подтверждённый backup/restore rehearsal и проверенный ownership каждого
   persistent volume.
5. Не менять image tags, lock-файлы, зависимости, схему БД, API, nginx,
   backup policy или данные в рамках этого тикета.

## Локальная валидация

Команды ниже только читают исходники Compose и проверяют синтаксис. Они не
печатают resolved config, не читают environment files и не стартуют сервисы.
`config --quiet` направляет stdout в `/dev/null`; ошибки остаются видимыми.

```bash
# Dev Compose: synthetic values only; no environment-file loading.
COMPOSE_DISABLE_ENV_FILE=1 \
POSTGRES_USER=synthetic POSTGRES_PASSWORD=synthetic POSTGRES_DB=synthetic \
REPL_USER=synthetic REPL_PASSWORD=synthetic REPL_SLOT=synthetic \
MINIO_ACCESS_KEY=synthetic MINIO_SECRET_KEY=synthetic \
docker compose -f technozrelost-backend/infra/docker-compose.yml config --quiet >/dev/null

# Production Compose: the same rule, including every required interpolation.
COMPOSE_DISABLE_ENV_FILE=1 \
POSTGRES_USER=synthetic POSTGRES_PASSWORD=synthetic POSTGRES_DB=synthetic \
REPL_USER=synthetic REPL_PASSWORD=synthetic REPL_SLOT=synthetic \
MINIO_ACCESS_KEY=synthetic MINIO_SECRET_KEY=synthetic MINIO_BUCKET=synthetic \
JWT_SECRET=synthetic-placeholder-not-a-secret \
CORS_ORIGINS=https://synthetic.invalid \
LLM_API_BASE=https://synthetic.invalid LLM_API_KEY=synthetic-placeholder \
LLM_MODEL=synthetic OPENCODE_API_KEY=synthetic OPENCODE_ZEN_API_KEY=synthetic \
REDIS_PASSWORD=synthetic GRAFANA_ADMIN_PASSWORD=synthetic \
NEXTAUTH_URL=https://synthetic.invalid NEXTAUTH_SECRET=synthetic-placeholder \
NEXT_PUBLIC_API_URL=https://synthetic.invalid API_URL_INTERNAL=http://backend:8000 \
BACKUP_OFFSITE_REMOTE=crypt:placeholder TELEGRAM_BOT_TOKEN= TELEGRAM_CHAT_ID= \
docker compose -f technozrelost-backend/infra/docker-compose.prod.yml config --quiet >/dev/null

cd technozrelost-backend
uv run pytest tests/test_container_hardening.py -q
uv run ruff check app tests infra/alerter scripts/udgu_ingest
uv run mypy app
uv run pytest -q
```

`uv sync --locked --extra dev` — единственная разрешённая подготовка backend
окружения; голый `uv sync` не используется. Если локальная locked-среда уже
сломана или недоступна, результат — `BLOCKED` с точной командой устранения,
а не silent install. Frontend-тесты не являются частью T13 regression, но
изменённый frontend Dockerfile проверяется вместе с focused backend test и
Compose syntax check.

## Состав change plan

**ПЛАН — НЕ ВЫПОЛНЯТЬ В ЭТОМ ТАСКЕ.** Все команды в этом разделе — только
подготовленный будущий сценарий. Их можно выполнять лишь после отдельного
письменного разрешения владельца: сначала в изолированном staging, затем (если
отдельное решение не запрещает) в production. T13 не запускает контейнеры,
не собирает и не тянет образы, не перезапускает сервисы и не меняет данные.

### Preconditions и staging

1. Получить отдельное разрешение на staging; разрешение на production не
   считается разрешением на staging и наоборот. Зафиксировать без вывода
   секретов: commit/revision, Compose revision, image tag/digest, Docker Compose
   version, host capacity, backup/restore marker и baseline health/5xx/latency.
2. Подготовить изолированный staging с disposable или заранее проверенными
   копиями persistent volumes. Проверить UID/GID и ownership каждого volume;
   не выполнять runtime `chown`, если ownership не подтверждён. Не использовать
   production database, MinIO bucket, Redis data или backup remote.
3. Проверить, что набор изменений ограничен этим Compose/Dockerfile change:
   нет image upgrade, миграций, изменения API, nginx config, схемы, данных или
   lock-файлов. В staging использовать только synthetic/sanitized inputs;
   `.env`, ключи, cookies и credential stores не читать и не выводить.
4. Согласовать maintenance/low-traffic window, лимит нагрузки и готовый
   rollback artifact. Для каждого компонента заранее записать ожидаемый
   restart и окно проверки; не переходить к следующему компоненту при stop gate.

### Будущие команды по компонентам

Во всех блоках `<approved-prod-env>`, `<approved-staging-project>` и
`<approved-host>` — placeholders, предоставленные оператором. Значения
environment/secret не печатаются. Каждая команда ниже помечена как
**ПЛАН; НЕ ВЫПОЛНЯТЬ**.

**Статическая проверка перед любым запуском:**

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ. Только после отдельного разрешения владельца.
COMPOSE_DISABLE_ENV_FILE=1 \
  POSTGRES_USER=synthetic POSTGRES_PASSWORD=synthetic POSTGRES_DB=synthetic \
  REPL_USER=synthetic REPL_PASSWORD=synthetic REPL_SLOT=synthetic \
  MINIO_ACCESS_KEY=synthetic MINIO_SECRET_KEY=synthetic \
  docker compose -f technozrelost-backend/infra/docker-compose.yml config --quiet >/dev/null
# ПЛАН; НЕ ВЫПОЛНЯТЬ. Только после отдельного разрешения владельца.
COMPOSE_DISABLE_ENV_FILE=1 \
  POSTGRES_USER=synthetic POSTGRES_PASSWORD=synthetic POSTGRES_DB=synthetic \
  REPL_USER=synthetic REPL_PASSWORD=synthetic REPL_SLOT=synthetic \
  MINIO_ACCESS_KEY=synthetic MINIO_SECRET_KEY=synthetic MINIO_BUCKET=synthetic \
  JWT_SECRET=synthetic-placeholder CORS_ORIGINS=https://synthetic.invalid \
  LLM_API_BASE=https://synthetic.invalid LLM_API_KEY=synthetic-placeholder \
  LLM_MODEL=synthetic REDIS_PASSWORD=synthetic GRAFANA_ADMIN_PASSWORD=synthetic \
  NEXTAUTH_URL=https://synthetic.invalid NEXTAUTH_SECRET=synthetic-placeholder \
  docker compose -f technozrelost-backend/infra/docker-compose.prod.yml config --quiet >/dev/null
```

**Backend custom image и `backend`:**

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ: только после отдельного staging/prod-разрешения.
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  build backend
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  up -d --no-deps --no-build backend
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml ps backend
curl --fail --silent --show-error https://<approved-host>/api/v1/ready
```

Ожидаемое воздействие: пересборка/перезапуск только backend-процесса, без
изменения схемы и данных; возможна краткая недоступность запросов во время
restart. Downtime — `UNKNOWN` до staging: измерить интервал от первого
неуспешного readiness до первого успешного `/api/v1/ready`, затем повторить
тот же замер в maintenance window; если измерение не получено, оставить
`UNKNOWN` и не переходить к production.

**Frontend custom image и `frontend`:**

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ: только после отдельного staging/prod-разрешения.
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  build frontend
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  up -d --no-deps --no-build frontend
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml ps frontend
curl --fail --silent --show-error https://<approved-host>/
```

Ожидаемое воздействие: краткий restart SSR/edge-ответа, без изменения данных
и API-контракта. Downtime — `UNKNOWN` до измерения staging по timestamp
перезапуска и успешному root/health probe; условие измерения такое же, как
для backend.

**PostgreSQL (`db` в prod; `pg-primary`/`pg-replica` в dev):**

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ: только после отдельного staging/prod-разрешения.
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  up -d --no-deps db
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml ps db
# Dev rehearsal plan; выполнять отдельно, с synthetic defaults, если разрешено.
docker compose --project-name <approved-staging-project> \
  -f technozrelost-backend/infra/docker-compose.yml up -d --no-deps pg-primary
docker compose --project-name <approved-staging-project> \
  -f technozrelost-backend/infra/docker-compose.yml ps pg-primary
docker compose --project-name <approved-staging-project> \
  -f technozrelost-backend/infra/docker-compose.yml up -d --no-deps pg-replica
docker compose --project-name <approved-staging-project> \
  -f technozrelost-backend/infra/docker-compose.yml ps pg-replica
```

Ожидаемое воздействие: перезапуск stateful-компонента и пауза dependent
readiness; миграции и запись данных не являются частью plan. Downtime —
`UNKNOWN`: измерить по healthcheck primary/replica и окну backend readiness;
для dev downtime не применяется, поскольку это изолированный rehearsal.
Запрещены `down -v`, удаление volume и попытка исправить ownership в рабочем
контейнере.

**ClamAV (`clamav` в prod и dev):**

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ: runtime-поведение образа не подтверждено T13.
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  up -d --no-deps clamav
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml ps clamav
docker compose --project-name <approved-staging-project> \
  -f technozrelost-backend/infra/docker-compose.yml up -d --no-deps clamav
docker compose --project-name <approved-staging-project> \
  -f technozrelost-backend/infra/docker-compose.yml ps clamav
```

Ожидаемое воздействие: возможен restart/восстановление сигнатур и временная
недоступность fail-closed file scan; данные приложения не меняются. Downtime —
`UNKNOWN` до staging healthcheck; измерять отдельно время до `healthy` и время
до успешного ClamAV PING/PONG. Если UID/capability или entrypoint не подтверждены,
остановить plan и вернуть `UNKNOWN/BLOCKED`, не добавляя `cap_add` наугад.

**MinIO и Redis (`minio`, `redis` в prod/dev):**

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ: только после отдельного staging/prod-разрешения.
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  up -d --no-deps minio redis
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml ps minio redis
docker compose --project-name <approved-staging-project> \
  -f technozrelost-backend/infra/docker-compose.yml up -d --no-deps minio redis
docker compose --project-name <approved-staging-project> \
  -f technozrelost-backend/infra/docker-compose.yml ps minio redis
```

Ожидаемое воздействие: краткая недоступность storage/rate-limit; existing
volumes и данные сохраняются. Downtime — `UNKNOWN` до отдельного health-gate
каждого сервиса в staging; при отсутствии измерения не переходить дальше.

**Nginx (`nginx`):**

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ: restart policy и security options проверяются после gate.
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  up -d --no-deps nginx
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml ps nginx
curl --fail --silent --show-error https://<approved-host>/healthz
```

Ожидаемое воздействие: короткое прерывание edge traffic; конфигурация и
TLS-конфиги не меняются. Downtime — `UNKNOWN` до staging; измерить окно между
последним успешным и первым неуспешным `/healthz` и возвратом 200.

**Prometheus и Grafana (`prometheus`, `grafana`):**

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ: только после отдельного staging/prod-разрешения.
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  up -d --no-deps prometheus grafana
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml ps prometheus grafana
curl --fail --silent --show-error http://127.0.0.1:9090/-/healthy
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

Ожидаемое воздействие: временный разрыв наблюдаемости, без изменения
метрик/конфигурации. Downtime — `UNKNOWN` до проверки обоих health endpoint;
scrape/alerts должны восстановиться до продолжения.

**Sidecars `backup-timer`, `wal-offsite`, `alerter`:**

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ: не запускать backup/restore или Telegram в тикете.
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  up -d --no-deps backup-timer wal-offsite alerter
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f technozrelost-backend/infra/docker-compose.prod.yml \
  ps backup-timer wal-offsite alerter
```

Ожидаемое воздействие: возможен пропуск цикла backup/WAL или alert probe
до следующего интервала; данные и markers не очищаются. Downtime — `UNKNOWN`
до staging; измерить age markers и отсутствие restart-loop, а не считать
пустой старт доказательством успешного offsite upload.

### Health/readiness и stop gate внутри change plan

После каждого атомарного шага в staging проверять `docker compose ps` и
соответствующий healthcheck: все затронутые сервисы — `healthy`, без
restart-loop и `unhealthy`. Backend readiness должен вернуть HTTP 200 и
ожидаемые статусы Primary/Redis/MinIO/ClamAV; Replica `not_configured` на
одноузловом prod не считается проверкой Replica. Frontend root/health,
nginx `/healthz`, Prometheus `/-/healthy`, Grafana `/api/health` и sidecar
PID/marker checks должны пройти. Дополнительно наблюдать 5xx, latency,
неожиданные записи, изменения persistent data/schema и отсутствие секретов
в выводе.

Немедленно остановить change, не чинить production на лету, при `unhealthy`,
росте 5xx, заметном latency, readiness failure, restart-loop, ошибке
ownership/UID, неожиданной записи, изменении данных/схемы, появлении
чувствительных данных или невозможности доказать runtime-поведение. После
stop trigger применяется только согласованный rollback; следующий компонент
не запускается до нового отдельного решения.

### Rollback-команды

Rollback также является **ПЛАНОМ; НЕ ВЫПОЛНЯТЬ**. Оператор сначала
восстанавливает согласованный предыдущий Compose revision и предыдущие
image tag/digest в staging или production change record, затем выполняет
команды ниже отдельной группой. `down -v`, удаление named volumes и
восстановление данных запрещены.

```bash
# ПЛАН; НЕ ВЫПОЛНЯТЬ. Prod rollback: каждый сервис запускается из approved previous revision.
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f <approved-previous-compose-prod> \
  up -d --no-build --no-deps db
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f <approved-previous-compose-prod> \
  up -d --no-build --no-deps minio clamav redis backend frontend nginx prometheus grafana backup-timer wal-offsite alerter
docker compose --project-name <approved-staging-project> \
  --env-file <approved-prod-env> -f <approved-previous-compose-prod> \
  ps

# ПЛАН; НЕ ВЫПОЛНЯТЬ. Dev rollback для затронутых dev-компонентов.
docker compose --project-name <approved-staging-project> \
  -f <approved-previous-compose-dev> up -d --no-build --no-deps pg-primary pg-replica minio redis clamav
docker compose --project-name <approved-staging-project> \
  -f <approved-previous-compose-dev> ps

# ПЛАН; НЕ ВЫПОЛНЯТЬ. Повторный gate после rollback; значения не печатать.
curl --fail --silent --show-error https://<approved-host>/api/v1/ready
curl --fail --silent --show-error https://<approved-host>/healthz
```

Rollback считается завершённым только после повторного `ps`, readiness и
health-gate. Если gate не проходит, сохранить failed state, остановить
change и запросить отдельное решение; не выполнять destructive recovery.

## Наблюдаемые health/readiness-критерии

- `docker compose ps` для всех затронутых сервисов показывает `healthy`; нет
  restart-loop, `unhealthy` или новых `5xx`/health probe failures.
- Backend `/api/v1/ready` отвечает `200`; в локальном synthetic rehearsal
  Primary/Redis/MinIO/ClamAV статусы соответствуют ожидаемой конфигурации,
  а Replica `not_configured` не трактуется как успешная проверка Replica.
- Frontend root/health endpoint отвечает успешно; nginx healthcheck и
  readiness не получают новых таймаутов.
- Backup/alerter sidecars продолжают работать, markers обновляются только в
  ожидаемых writable volumes; `/tmp` и frontend cache не растут без границы.
- Не появляются новые latency, 5xx, неожиданные записи, изменения схемы или
  чувствительные данные в логах/отчётах. Значения секретов не выводятся.

Это критерии будущего rehearsal, а не результат выполненного сейчас запуска:
контейнеры в T13 не стартуют.

## Rollback

Rollback выполняется только через согласованный deployment process после
отдельного разрешения. Восстанавливается предыдущий Compose revision и
предыдущие backend/frontend image tags; named volumes, backup snapshots и
данные не удаляются (`down -v` запрещён). Если приложение не проходит health
gate, rollback немедленно возвращает предыдущий набор и повторяет readiness
проверку. T13 не исполняет rollback и не изменяет production; оператор
фиксирует причину, stop trigger и результат в change record без секретов.

## Немедленные stop conditions

Остановить change и не пытаться чинить на production при любом из условий:

- рост `5xx`, `unhealthy`, restart-loop или readiness failure;
- заметный рост latency, потеря health endpoint или невозможность запуска
  процесса под заявленным UID;
- неожиданная запись вне перечисленных volumes/tmpfs, ошибка ownership или
  изменение persistent data/schema;
- появление токена, cookie, email, телефона, ключа или пользовательского
  содержимого в выводе/логах/отчёте;
- невозможность подтвердить поведение образа безопасно без контейнерного
  запуска — фиксировать `UNKNOWN/BLOCKED`, не угадывать UID или capability.

## Что покрыто regression-тестом

`tests/test_container_hardening.py` статически перечисляет все dev/prod
сервисы, проверяет user/capability/no-new-privileges/read-only/tmpfs
контракт, build-time ownership обоих Dockerfile и реестр исключений. Удаление
или ослабление обязательного поля удаляет PASS; исключение без записи в
runbook также считается ошибкой. Тест не стартует, не строит и не тянет
контейнеры.
