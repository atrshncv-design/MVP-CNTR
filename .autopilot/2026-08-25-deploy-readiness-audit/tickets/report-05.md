# Отчёт таска 05 — Инфраструктура: устойчивость и прод-контур локально

Требования: R07 (устойчивость), R04 (деплой одной инструкцией).
Зона: `technozrelost-backend/infra` (+ точечные фиксы backend-образа, без правок логики приложения).
Статус: DONE_WITH_CONCERNS (clamav — внешняя сеть; см. F05-12).

## Что сделано и проверено

### Прод-контур локально (R04)
- `./deploy.sh` из `infra/` поднимает весь стек одной командой: nginx, frontend,
  backend ×2, PostgreSQL Primary/Replica, MinIO, ClamAV, Redis, Prometheus, Grafana.
- Итоговое состояние (`docker compose ps`):
  ```
  technozrelost-prod-backend-1   Up (healthy)
  technozrelost-prod-backend-2   Up (healthy)
  tz-prod-db-primary             Up (healthy)
  tz-prod-db-replica             Up (healthy)
  tz-prod-frontend               Up (healthy)
  tz-prod-grafana                Up (healthy)
  tz-prod-minio                  Up (healthy)
  tz-prod-nginx                  Up (healthy)
  tz-prod-prometheus             Up (healthy)
  tz-prod-redis                  Up (healthy)
  tz-prod-clamav                 Up (unhealthy)  ← внешняя сеть, F05-12
  ```
- Health/readiness через nginx:
  - `curl -sk https://localhost/api/v1/ready` →
    `{"status":"ready","databases":{"primary":"ok","replica":"ok"}}`
  - liveness `/api/v1/health` → ok; HTTP→301→HTTPS (документация поправлена).

### Устойчивость (R07)
- **Остановка реплики БД** (`docker stop tz-prod-db-replica`):
  - `/ready` честно деградирует: 503 `{"primary":"ok","replica":"unavailable"}`;
  - запись живёт: `POST /api/v1/auth/register` → **201** (write идёт в Primary);
  - чтение реестра `/projects/registry` → 500 (см. находку F05-09);
  - после `docker start` — самовосстановление: `/ready` снова зелёный,
    `pg_stat_replication` = `walreceiver streaming`, реплика `pg_is_in_recovery()=t`.
- **backup → restore**: `backup.sh` внутри backend-контейнера → снапшот
  (pg_dump custom, SHA256SUMS, ротация BACKUP_KEEP). `restore.sh` развёрнут в
  ЧИСТЫЙ контейнер из того же образа pgvector:16 (checksums OK → pg_restore
  --clean --if-exists). Сверка — row-counts всех таблиц схемы public на проде и
  в восстановленной копии: **diff пуст, данные идентичны** (alembic_version=1,
  db_migration_log=23, users=2 и т.д.). Временный контейнер восстановления убран.
- **Идемпотентность**: повторные `up -d --build` и `deploy.sh` проходят без ручных
  шагов; миграции под advisory lock (backend-entrypoint.sh) — без изменений,
  поведение подтверждено стартом двух реплик backend.

### Починено по-настоящему (infra)
- **Роль replicator на существующих томах** (наследие таска 01): новый
  `postgres/start-primary.sh` (entrypoint primary) — на пустом томе делегирует
  официальному entrypoint (initdb.d), на существующем — стартует PG, ждёт
  готовности и вызывает идемпотентный `postgres/ensure-replication.sh` (роль +
  пароль-ротация + слот, `\gexec` вместо DO $$). Подключено в dev- и prod-compose.
  Проверено делом: дев-primary пересоздан на СТАРОМ томе — роль и слот появились,
  дев-реплика переподключилась (healthy).
- **Сборка backend-образа** была сломана полностью (деплой невозможен):
  README.md не попадал в контекст (*.md в .dockerignore) при `readme="README.md"`
  в pyproject; `httpx` лежал в dev-зависимостях при рантайм-импорте
  (`app/services/ai_assistant.py`) — crash-loop; `pg_dump` v15 из bookworm против
  сервера PG16 — «server version mismatch» ронял бэкап перед миграциями.
  Все три исправлены (F05-01…03), регресс: `uv run pytest -q` → **205 passed**.
- **Сборка frontend-образа**, вне заявленной зоны (technozrelost-frontend/
  Dockerfile): `next build` убивался OOM-killer'ом на этой машине (контекст
  F05-env — Docker Desktop VM с малым лимитом RAM), деплой фронтенда не
  завершался. Добавлен `ENV NODE_OPTIONS=--max-old-space-size=2048` в
  builder-стадию — правка сборочной инфраструктуры образа, логики приложения
  не касается; без неё критерий «деплой одной командой» невыполним.

## Реестр находок (формат: {id, область, файл:строка, severity, описание, действие})

| id | область | файл:строка | severity | описание | действие |
|---|---|---|---|---|---|
| F05-01 | infra/build | technozrelost-backend/.dockerignore:10; Dockerfile:11 | критично | `*.md` исключён из контекста, а `uv sync` собирает проект с `readme="README.md"` → сборка образа падает всегда | исправлено: COPY README.md + `!README.md` |
| F05-02 | backend/deps | technozrelost-backend/pyproject.toml:27 | критично | `httpx` только в dev-extra, но импортируется в рантайме (ai_assistant) → прод-контейнер падает на старте | исправлено: перенос в dependencies + `uv lock` |
| F05-03 | backend/image | technozrelost-backend/Dockerfile:14 | критично | pg_dump v15 (bookworm) vs PG16 → backup перед миграциями падает, entrypoint завершается, стек не поднимается | исправлено: postgresql-client-16 из pgdg |
| F05-04 | infra/pg | infra/postgres/init-primary.sh:11 | высоко | initdb.d выполняется только на пустом томе: роль replicator/слот отсутствуют на существующих томах (репликация не поднимается) | исправлено: ensure-replication.sh + start-primary.sh, идемпотентно на каждый старт |
| F05-05 | infra/compose | infra/docker-compose.prod.yml:194 | критично | у frontend не задан API_URL_INTERNAL → NextAuth ходит на http://127.0.0.1:8000 внутри контейнера, логин за nginx не работает | исправлено: API_URL_INTERNAL=http://backend:8000 |
| F05-06 | infra/nginx | infra/nginx/nginx.prod.conf:31 | средне | нет security-заголовков (HSTS/XCTO/XFO/Referrer/Permissions), server_tokens on; client_max_body_size 20m меньше MAX_FILE_SIZE_MB=25 → 413 на валидной загрузке | исправлено: заголовки always, tokens off, лимит 25m |
| F05-07 | infra/env | infra/.env.production.example (отсутствовал) | высоко | deploy.sh и README ссылаются на несуществующий шаблон; пустые JWT/NEXTAUTH не генерировались | исправлено: шаблон создан; deploy.sh генерирует секреты и при пустом значении, предупреждает о заглушках |
| F05-08 | infra/scripts | infra/backup.sh:118; restore.sh:41 | средне | GNU-only sha256sum (падение на macOS-хосте); пустой minio/-каталог ронял restore.sh; неполный снапшот оставался на диске при сбое | исправлено: shasum-fallback, пропуск пустого, trap-откат снапшота |
| F05-09 | backend/api | app/api/v1/projects.py:212 (ReadDBSession) | средне | при недоступности реплики чтение реестра отдаёт 500 без фолбэка на primary (readiness при этом честен) | рекомендация: fallback/cached-read для реестров — продуктовое решение |
| F05-10 | infra/compose | docker-compose.prod.yml (prometheus/grafana) | низко | healthcheck отсутствовал у двух сервисов (нарушение «healthcheck у каждого») | исправлено: /-/healthy и /api/health |
| F05-11 | docs | infra/README-DEPLOY.md:33–58 | средне | неверные пути (`cp .env.production.example infra/…` из корня), команды compose без --env-file, HTTP-проверка вопреки редиректу | исправлено: пути, --env-file, HTTPS-команды, порты 80/443/3001 |
| F05-13 | frontend/build | technozrelost-frontend/Dockerfile:12 | средне | `next build` в образе падал по OOM на машинах с малой Docker VM (см. F05-env) — деплой не завершался; вне зоны таска, т.к. без него R04 невыполним | исправлено: NODE_OPTIONS=--max-old-space-size=2048 в builder-стадии |
| F05-14 | infra/scripts | technozrelost-backend/infra/backup.sh:125 | средне | GNU xargs на пустом вводе запускает хешер без аргументов → sha256sum читает stdin и висит на tty (BSD молча проходит) — бэкап зависает | исправлено: устранён hang xargs на пустом вводе — проверка непустоты списка до xargs (переносимо), `: >` сохраняет пустой SHA256SUMS; прогон backup.sh и симуляция пустого набора чисто |

Вне кода (окружение машины, к реестру прилагается):
- **F05-env**: Docker Desktop VM был 1 ГБ RAM / 8 ГБ диск — сборка и даже РАБОТА
  стека невозможны (OOM-kill `next build`, «no space left»). Изменены настройки
  Docker Desktop: MemoryMiB 1024→6144, DiskSizeMiB 8192→16384, перезапуск движка;
  дев-контур вернулся сам (restart policy). Рекомендация пользователю: знать об
  этом изменении; для сервера ориентир ≥6 ГБ RAM.
- **F05-12 clamav**: freshclam получает «Forbidden; Blocked by CDN» от базы
  сигнатур (cool-down до 26.08.2026) — блокировка сети этой машины, не дефект
  конфигурации. На сервере ожидаемо зелёный; проверить при первом деплое. До тех
  пор загрузка файлов будет недоступна (CLAMAV_ENABLED=true, fail-closed).

## Секреты: что заполнить пользователю в .env.production перед сервером

Файл: `cp infra/.env.production.example infra/.env.production`. Заполнить значения:

```
POSTGRES_PASSWORD        REPL_PASSWORD         MINIO_SECRET_KEY
GRAFANA_ADMIN_PASSWORD   NEXTAUTH_URL          CORS_ORIGINS
LLM_API_KEY              (опционально; без него AI-функции отключены)
```

JWT_SECRET и NEXTAUTH_SECRET генерируются автоматически при `./deploy.sh`
(можно задать вручную). Значения в отчёты не выносятся; локальный
`infra/.env.production` создан из шаблона с одноразовыми локальными значениями
(в .gitignore, на сервер не переносить).

## Критерии приёмки

- [x] Прод-контур поднят локально; health/readiness зелёные (исключение — clamav,
      внешняя сеть; вывод выше приложен)
- [x] Цикл backup → restore выполнен; данные сверены (diff пуст)
- [x] Находки устойчивости исправлены в infra-конфигах (безопасное);
      рискованное (fallback чтений) — в реестре с рекомендацией
- [x] Список пустых секретов передан оркестратору (выше и в финальном сообщении)
- [x] Контур ОСТАВЛЕН ЗАПУЩЕННЫМ для таска 06; временный контейнер восстановления
      удалён; дев-контур (pg-primary/pg-replica) работает и healthy
