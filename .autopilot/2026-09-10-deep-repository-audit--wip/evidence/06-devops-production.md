# Evidence 06: DevOps, production security и восстановление

## База и ограничения

- Проверен checkout `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`, ветка
  `audit/deep-repository-20260910`, 2026-09-10. Worktree уже содержал чужие изменения в
  `.autopilot/`; они не менялись. Продуктовые файлы, зависимости и данные не изменялись.
- `executor.md` отсутствует как в корне worktree, так и во всём
  `/var/folders/18/nv2y391s5gvcp3mfk76xcny80000gn/T/opencode`; аудит выполнен по доступным
  `interfaces.md`, тикету 06 и только разрешённым пользователем разделам `spec.md`.
- `.env` не открывались. Прочитаны только отслеживаемые `.env.example` и
  `infra/.env.production.example`; ниже приведены только имена переменных и публичные defaults.
- Не выполнялись `docker compose up/down/run`, deploy, migration, backup, restore, PITR,
  Telegram или production smoke. `docker compose config --quiet` не обращается к daemon и не
  выводит resolved credentials; live-свойства явно оставлены `BLOCKED`.

## Проверенная карта

| Область | Трасса | Результат |
|---|---|---|
| Images | backend/frontend `Dockerfile`; все `image:` в dev/prod Compose | multi-stage builds есть; app images root; большая часть tags/digests не закреплена |
| Dev wiring | `infra/docker-compose.yml:3-133` | persistent volumes/probes есть; шесть внутренних портов опубликованы на всех host interfaces с dev defaults |
| Prod wiring | `infra/docker-compose.prod.yml:23-605` | наружу только nginx `80/443`; log rotation у всех сервисов; probes у всех; limits только у backend/ClamAV |
| Edge | `infra/nginx/nginx.prod.conf:10-195` | TLS/rate limits/body limit/DNS refresh/cache/security headers; self-signed accepted, SSE request-id не forwarded |
| Deploy | `infra/deploy.sh:44-425`, `infra/backend-entrypoint.sh:10-135` | secret preflight, SHA tags, migration/backup locks, health gate; image rollback does not revert schema |
| Data safety | `backup.sh`, `restore.sh`, `backup-lock.py`, cron scripts, PG configs, `RUNBOOK-DATA.md` | checksums, logical+physical backup, WAL, crypt guard; offsite optional; restore non-atomic across DB/MinIO |
| Probes | `app/api/v1/health.py:15-124`, prod Compose healthchecks | true liveness endpoint exists; container health uses aggregate readiness including every dependency |
| Observe | `logging_config.py`, metrics middleware, Prometheus config, alerter | JSON app logs/request ID, bounded metrics, per-replica DNS scrape, custom operational checks; no distributed tracing/exporters/rules |
| CI/CD | `.github/workflows/ci.yml:1-107` | app gates, dependency audits and backend image build; no CD, resolved prod/nginx/frontend-image/scanner gates; Python differs from image |
| Shutdown/versioning | app lifespan, entrypoints, Compose | scheduler cancels; Uvicorn gets SIGTERM via `exec`; sidecars have no signal trap/stop budget; releases are local image tags only |

## Подтверждённые кандидаты

### B06-001: Dev Compose публикует хранилища с известными слабыми defaults

- Category: internal exposure / insecure defaults
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/infra/docker-compose.yml:8-16`, `:41-50`, `:69-80`,
  `:91-99`, `:106-113`
- Evidence: PostgreSQL Primary/Replica, MinIO API/console, Redis и ClamAV используют short-form
  `HOST:CONTAINER`, то есть bind на `0.0.0.0`; PostgreSQL/replication/MinIO имеют известные
  `change_me` defaults, Redis запускается вообще без authentication.
- Safe reproduction: `docker compose config` показывает published ports; после обычного dev
  запуска сосед в той же Wi-Fi/LAN обращается к `<developer-ip>:6379`, `<developer-ip>:9000` или
  `<developer-ip>:5432` и использует известный default. Live подключение не выполнялось.
- Impact: чтение/изменение dev-данных, Redis state/SSE/rate-limit и проектных файлов; особенно
  опасно, если разработчик использует копию реальных ПДн/НИОКР.
- Remediation: bind dev ports к `127.0.0.1`, не публиковать ClamAV/Redis без необходимости,
  требовать локальные случайные credentials или отдельный явно opt-in insecure profile.
- Tests: resolved dev Compose должен иметь `host_ip=127.0.0.1` для каждого published port;
  negative test запрещает `change_me` при profile с внешним bind.
- Dependencies: нет.

### B06-002: Автоматический rollback оставляет уже применённую схему новой версии

- Category: deployment / rollback integrity
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/infra/backend-entrypoint.sh:84-125`,
  `technozrelost-backend/infra/deploy.sh:320-346`, `:387-396`,
  `technozrelost-backend/infra/README-DEPLOY.md:141-149`
- Evidence: каждая новая backend replica выполняет `alembic upgrade head` до запуска Uvicorn.
  При провале health-gate `automatic_rollback` делает только `compose up -d --no-build` со старыми
  backend/frontend images. Ни revision до deploy, ни downgrade/restore не выполняются; runbook
  прямо говорит, что ломающая schema требует отдельного restore/PITR.
- Safe reproduction: релиз содержит migration rename/drop и затем frontend/backend startup
  defect. Migration проходит, health-gate падает, `previous` image возвращается и обращается к
  старому column/table contract в уже новой БД.
- Impact: автоматический rollback сообщает ошибку либо не может вернуть сервис; RTO зависит от
  ручного destructive DR вместо заявленного image rollback.
- Remediation: только expand/contract migrations с проверяемым окном совместимости; отдельный
  one-shot migrator перед сменой replicas; сохранять old/new Alembic revision и запрещать auto
  rollback при несовместимой schema либо автоматизировать доказанную компенсацию.
- Tests: shell harness с fake compose/docker и migration revision должен доказать failed-release
  rollback на совместимой schema; CI migration-compatibility test запускает old image contract
  после upgrade новой revision.
- Dependencies: migration policy, production-like rollback rehearsal.

### B06-003: Публичный backend совмещает app runtime с root и backup/offsite полномочиями

- Category: container privilege / blast radius
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/Dockerfile:14-57`,
  `technozrelost-backend/infra/docker-compose.prod.yml:206-249`, `:261-289`,
  `technozrelost-frontend/Dockerfile:24-34`
- Evidence: оба app Dockerfile не задают `USER`; Compose не задаёт `user`, `cap_drop`,
  `no-new-privileges` или read-only rootfs. Более того, обычная backend replica получает DB,
  MinIO root, replication, Redis и rclone-related environment/config, а также RW volume
  `backups-prod-data`. Миграции и pre-migration backup выполняются тем же публичным process image.
- Safe reproduction: при RCE в любом HTTP/parser dependency payload исполняется как container
  root, читает runtime credentials/rclone config, меняет локальные backups и подключается к
  Primary/MinIO с административными полномочиями.
- Impact: компрометация одного app process расширяется до всех данных и recovery plane; attacker
  может удалить локальные копии перед шифрованием/порчей production data.
- Remediation: non-root UID/GID, `cap_drop: [ALL]`, `no-new-privileges`, read-only rootfs+tmpfs;
  вынести migration/backup в отдельные one-shot identities, убрать REPLICATION/rclone/backups RW
  из runtime backend, использовать scoped MinIO app account вместо root.
- Tests: image metadata asserts non-zero UID; resolved Compose policy test для app services;
  negative runtime contract доказывает отсутствие backup/replication credentials и RW backup mount.
- Dependencies: split migrator/backup services and credentials.

### B06-004: Сетевая сегментация допускает lateral movement от edge к data plane

- Category: network isolation
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/infra/docker-compose.prod.yml:64-65`, `:130-131`,
  `:183-184`, `:287-289`, `:479-481`, `:509-511`, `:589-605`
- Evidence: DB, MinIO, Redis и ClamAV находятся в `tz-app-db`; туда же напрямую включены публичный
  nginx и frontend. Ни одна сеть не имеет `internal: true`. Поэтому `tz-edge` не является
  реальной boundary, а compromise nginx/frontend получает TCP reachability ко всему data plane.
- Safe reproduction: после RCE в frontend/nginx container просканировать service DNS names
  `db:5432`, `redis:6379`, `minio:9000`, `clamav:3310`; network policy соединения не блокирует.
- Impact: увеличенный blast radius edge compromise и возможность атаковать внутренние protocols,
  хотя host ports production корректно закрыты.
- Remediation: отдельная proxy network nginx↔frontend/backend; backend-only internal dependency
  network; monitoring-only network; не подключать nginx/frontend к DB/storage network.
- Tests: resolved-network adjacency matrix запрещает paths edge→DB/Redis/MinIO/ClamAV.
- Dependencies: nginx/backend network split.

### B06-005: Production проходит deploy без offsite и без канала уведомлений

- Category: disaster recovery / production guard
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/infra/docker-compose.prod.yml:241-243`, `:320-323`,
  `:371-375`, `:435-436`; `technozrelost-backend/infra/deploy.sh:186-205`;
  `technozrelost-backend/infra/cron/wal-offsite-sync.sh:94-104`;
  `technozrelost-backend/infra/.env.production.example:77-96`, `:107-109`
- Evidence: example leaves `BACKUP_OFFSITE_REMOTE`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
  empty; deploy preflight does not require them. WAL sidecar deliberately returns success with a
  warning when target is absent, so service health and deploy health-gate pass. DB, MinIO, WAL and
  local snapshots are Docker named volumes on the same host/failure domain.
- Safe reproduction: use the shipped production example with required passwords but empty three
  variables; static resolved config is valid and all sidecar healthchecks permit this state. Loss
  of the server/storage destroys Primary, MinIO, WAL archive and local snapshots together.
- Impact: complete unrecoverable data loss is an accepted production state and operator may receive
  no alert; this contradicts the project's zero-loss/RPO objective.
- Remediation: `PRODUCTION_STRICT_DR=1` default requiring crypt remote and Telegram (or approved
  alternate notifier), fail deploy until an authenticated write/read probe artifact exists; put
  local backup/WAL on a genuinely separate device, not merely another named volume.
- Tests: deploy preflight rejects absent DR/notifier in strict mode; external smoke uploads,
  downloads and verifies encrypted snapshot+WAL and records restore drill artifacts.
- Dependencies: operator-provided crypt remote and notification channel.

### B06-006: Неудачная Telegram-эскалация critical больше никогда не повторяется

- Category: alert delivery reliability
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/infra/alerter/alerter.py:680-731`,
  `technozrelost-backend/infra/alerter/test_alerter.py:456-476`
- Evidence: после уже отправленного warning при escalation в critical и неуспешном `send`, ветка
  `:723-730` сохраняет `notification_sent=True` и сразу повышает stored severity до `critical`.
  Следующий identical critical уже не считается escalation и notification event отсутствует.
  Имеющийся тест покрывает только успешную вторую отправку.
- Safe reproduction: executable no-network sequence `warning(send=True) -> critical(send=False)
  -> critical(send=True)` вернула `AlertState(... notification_sent=True, severity='critical')` и
  `third_cycle_event=None`. Реалистично: offsite warning
  уже отправлен, затем падает DB, а Telegram timeout случается на первой critical попытке.
- Impact: единственный критический сигнал о полном outage теряется навсегда до recovery/new severity;
  оператор видит только старое warning.
- Remediation: обновлять `notification_sent/severity` только после успешной доставки; хранить
  pending severity, bounded exponential retry и timestamp/attempt counter.
- Tests: failed warning→critical delivery повторяется до success; restart from persisted pending
  state продолжает retry; rate bound предотвращает storm.
- Dependencies: нет.

### B06-007: Production health-gate принимает автоматически созданный self-signed TLS

- Category: transport security / deploy guard
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/infra/deploy.sh:260-262`, `:379-400`;
  `technozrelost-backend/infra/nginx/nginx.prod.conf:70-78`;
  `technozrelost-backend/infra/README-DEPLOY.md:231-238`
- Evidence: отсутствие certificate files приводит не к отказу, а к генерации self-signed RSA cert;
  readiness использует `curl -k`, поэтому не проверяет trust, hostname или expiry. Deploy печатает
  предупреждение, но объявляет release прошедшим health-gate; nginx одновременно включает HSTS.
- Safe reproduction: первый deploy на чистом server без cert files генерирует cert CN
  `technozrelost`; health passes из-за `-k`, браузер реального домена показывает interstitial.
- Impact: оператор может принять небезопасный transport за production-ready; пользователи,
  привыкшие обходить warning, уязвимы для MITM, а HSTS осложняет доступ/восстановление.
- Remediation: self-signed разрешать только explicit staging flag; production preflight проверяет
  SAN hostname, chain, expiry и key permissions; readiness к public endpoint без `-k`.
- Tests: clean production preflight без trusted cert fails; fixture cert with wrong SAN/expiry fails.
- Dependencies: production DNS/CA certificate.

### B06-008: Restore может оставить БД и MinIO в разных состояниях

- Category: restore atomicity / recovery correctness
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/infra/restore.sh:147-168`, `:205-262`
- Evidence: script полностью применяет `pg_restore` и затем начинает MinIO restore. Python fallback
  сначала удаляет все target objects (`:245-246`), затем загружает их по одному (`:247-253`). При
  сетевой/space failure нет staging bucket, rollback или marker partial state.
- Safe reproduction: restore в пустую DB с валидным snapshot; после successful `pg_restore`
  заставить MinIO оборвать upload второго object. Script exits non-zero, но DB уже восстановлена,
  а bucket частично/полностью очищен; повтор требует снова очищать DB из-за preflight.
- Impact: аварийная процедура сама создаёт inconsistent/unreadable deployment и усложняет RTO;
  оператор не может безопасно resume documented command.
- Remediation: restore DB и MinIO в staging targets, verify counts/checksums, затем controlled cutover;
  либо documented idempotent resume/compensation and explicit partial marker.
- Tests: fault injection на N-м MinIO object доказывает, что live target не меняется; повтор после
  interruption завершается успешно.
- Dependencies: restore orchestration design.

## Расчётные риски и пробелы

### B06-009: Resource budget не ограничивает большинство production services

- Category: capacity / failure domain
- Proposed severity: Medium
- Confidence: Probable
- Files: `technozrelost-backend/infra/docker-compose.prod.yml:145-149`, `:200-205`,
  `:25-184`, `:291-605`; `technozrelost-frontend/Dockerfile:12-14`, `:24-34`
- Evidence: limits заданы только ClamAV (4 GiB/2 CPU) и двум backend replicas (по 2 GiB/1 CPU),
  то есть уже до 8 GiB из документированного minimum 12 GiB. DB Primary/Replica, MinIO, Redis,
  frontend runtime, nginx, three sidecars, Prometheus и Grafana не имеют CPU/RAM/PID limits или
  reservations. Frontend heap limit 2 GiB задан только build stage, не runner.
- Safe reproduction: расчётный, не измеренный сценарий: рост Prometheus series/Next SSR/MinIO I/O
  или runaway process потребляет host memory; host OOM выбирает DB/backend/alerter, и единый host
  теряет app+observe+recovery одновременно. RPS/p95 для 100/500/1000/5000/10000 не приписываются.
- Impact: непредсказуемый host-wide outage и отсутствие admission/capacity contract.
- Remediation: измерить RSS/CPU/I/O, задать limits+reservations+pids, Compose-level memory budget
  <= host capacity with OS reserve; вынести data/offsite failure domains при росте.
- Tests: resolved Compose budget checker; production-like load/soak artifacts at stated concurrency,
  OOM/fill-disk drill verifies alerts and graceful degradation.
- Dependencies: capacity target and production-like host.

### B06-010: Supply-chain и CI не доказывают воспроизводимый production artifact

- Category: CI/CD / version pinning / environment parity
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/Dockerfile:2`, `:14`, `:22-30`;
  `technozrelost-frontend/Dockerfile:2-7`, `:24`; `technozrelost-backend/infra/docker-compose.prod.yml:26`,
  `:165`, `:485`, `:515`, `:544`; `.github/workflows/ci.yml:13-14`, `:50-79`, `:81-107`
- Evidence: app base images, PostgreSQL, Redis, nginx, Prometheus and Grafana use mutable tags without
  digest (only MinIO/ClamAV are digest-pinned); apt packages are resolved at build time. GitHub actions
  are major tags, runner is `ubuntu-latest`. CI tests Python 3.11 while backend image is 3.12, builds
  only backend image, and does not run resolved prod Compose, `nginx -t`, frontend image build,
  image vulnerability scan/SBOM/signing, deploy/rollback contract or publish immutable artifacts.
- Safe reproduction: rebuild the same SHA after upstream tag/repository movement; resulting base/apt
  layers can differ. A frontend Dockerfile/nginx/Compose-only regression can merge while all listed CI
  steps remain green.
- Impact: local SHA tag does not identify immutable bytes; supply-chain drift and production-only
  failures are detected during manual deployment.
- Remediation: digest-pin bases/services/actions; scheduled Renovate/Dependabot policy; build both
  images once in CI, scan+SBOM+sign, publish by digest, run Compose/nginx config gates and promote the
  same digest; test Python 3.12 (optionally supported matrix).
- Tests: CI policy test rejects unpinned production refs/actions and asserts both image/config/scanner
  gates; artifact provenance attestation is retained per release.
- Dependencies: registry/signing/update policy.

## Положительные контракты

- Production host exposure ограничено nginx `80/443`; DB/storage/observe используют only `expose`
  or no port (`docker-compose.prod.yml:493-505`, `:513-573`).
- Все production services имеют json-file rotation `10m x 3`; backend/ClamAV имеют limits; persistent
  data volumes перечислены (`docker-compose.prod.yml:575-587`).
- Secret guards отклоняют weak JWT/NextAuth/PostgreSQL/MinIO/Redis/replication/Grafana values through
  deploy+app checks (`deploy.sh:96-205`, `app/core/config.py:101-133`); `.dockerignore` исключает `.env*`.
- DB migration и backup используют разные PostgreSQL advisory locks; backup fail blocks migration;
  two replicas do not concurrently migrate (`backend-entrypoint.sh:54-131`, `backup-lock.py:121-208`).
- Backup requires logical dump, physical basebackup, MinIO and SHA256; WAL archive is atomic, crypt
  offsite guard fail-closed against plaintext remote (`backup.sh:112-285`, `:318-385`; PITR config).
- Backend `/health` is dependency-free liveness; `/ready` checks Primary, Replica, Redis, MinIO and
  ClamAV and returns 503 on unavailable (`app/api/v1/health.py:15-124`). Scheduler task is cancelled
  in lifespan and Uvicorn is `exec`'d, so app SIGTERM reaches PID 1 (`app/main.py:92-102`,
  `backend-entrypoint.sh:134-135`).
- App logs are JSON with request-id and redaction; Prometheus discovers both backend replicas by DNS.
  This is correlation, not distributed tracing (`logging_config.py:61-111`, `prometheus.yml:15-22`).

## Команды и фактический результат

| Команда | Результат |
|---|---|
| `git status --short; git rev-parse HEAD; git branch --show-current` | SHA/branch подтверждены; pre-existing `.autopilot` dirty/untracked |
| `docker compose --env-file infra/.env.production.example -f infra/docker-compose.prod.yml config --quiet` | PASS, no output; daemon/container state не затронут |
| `docker compose -f infra/docker-compose.yml config --quiet` | PASS, no output |
| `bash -n ...; sh -n ...` для deploy/backup/restore/PITR/cron/PG scripts | PASS, no output |
| `bash infra/deploy.sh --help` | PASS; не потребовал env и ничего не изменил |
| `BACKUP_TIMER_SELF_CHECK=1 uv run sh infra/cron/backup-timer.sh` с repo script paths | PASS; будущий target вычислен, backup не запускался |
| `uv run python infra/alerter/alerter.py --self-check` | PASS: `alerter self-check: ok` |
| no-network Python sequence для B06-006 | CONFIRMED: failed critical escalation дала следующему циклу `event=None` |
| `uv run pytest --noconftest ... test_alerter.py` и static pytest gates | BLOCKED: `pytest` отсутствует в текущем locked environment; установка запрещена |
| `python3 ... alerter.py --self-check` | BLOCKED host Python 3.9: `datetime.UTC` unavailable; штатный `uv run python` PASS |

## BLOCKED external evidence

- Production deploy/rollback и schema compatibility: запрещены условиями аудита, нет безопасного
  production-like контура.
- Backup/PITR/offsite/restore и Telegram delivery: запрещены; отсутствуют operator remote/credentials
  и live artifact. Исторический report является только указателем, не доказательством текущего SHA.
- Container runtime UID/capabilities/read-only and graceful stop under in-flight backup: Docker
  inspect/stop/run не выполнялись; static config показывает отсутствие hardening directives.
- Capacity at 100/500/1000/5000/10000 concurrent, p95/RPS, OOM/fill-disk/failover: нет разрешённого
  isolated load/failure stand; B06-009 остаётся расчётным risk, не измерением.
