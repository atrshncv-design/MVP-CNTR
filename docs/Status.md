# STATUS / CURRENT STATE

## Дорожная карта до приёмки — M0/G1 (28.08.2026)

- ✅ Проведено глубокое CTO-интервью: госконтракт подписан, сдача — декабрь 2026, прод на сервере заказчика (доступа нет), команда = владелец + AI-агенты, цель надёжности «простой ≤1 ч / ноль потерь», алерты в Telegram, ядро демо = жизненный цикл проекта + реестр НИОКТР + AI.
- ✅ Независимая верификация аудита: заявления честны, полнота примерно 65–70%; реестр исправлен до 65 находок: P0 — 14, P1 — 24, P2 — 27.
- ✅ Локальная реализация M0: committed baseline заканчивается на HEAD `7f6ad43`; последующие backend/infra repairs находятся dirty/uncommitted и не покрыты историческими commit hashes.
- ✅ Независимые final local results: backend `334 passed` (single process), frontend `39 passed`, lint/build, ruff/mypy, `npm audit` и `pip-audit` зелёные; alerter `28 passed`, infra focused tests зелёные.
- ✅ Dev PostgreSQL smoke: primary и replica healthy, slot `tz_replica_slot` active, replica `pg_is_in_recovery=true`, WAL receiver streaming, passfile `0600`.
- ⚠️ G1 открыт: remote GitHub Actions не проверен. Production deploy, offsite/PITR, Telegram delivery и rollback live smoke не проверялись; требуются operator crypt remote/config и production-like capacity.
- ⚠️ Открыты организационные вопросы: нет ТЗ/критериев приёмки, доступа к серверу заказчика и утверждённых рамок 152-ФЗ УЗ/КИИ/импортозамещения.
- ⏸️ Следующий шаг: провести внешние G1-проверки на доступном production-like контуре; только после этого обновлять P0 до полного `done`.

### T05 repair — 27.08.2026

- ✅ Исправлен boundary-баг `backup-timer.sh`: target фиксируется до ожидания, добавлены
  общий `next_target`, проверка существования `BACKUP_SCRIPT` и self-check без ожидания
  суток/запуска backup; `BACKUP_AT` принимает только часы `00..23` и минуты `00..59`.
- ✅ Offsite-проводка усилена: distro `rclone` в production image, read-only named
  volume `tz-prod-rclone-config`, conditional healthcheck с требованием `rclone` только
  при заданном remote.
- ✅ Offline-проверки: shell syntax, timer boundary/RUN_ONCE, Compose config wiring,
  Dockerfile `buildx --check`, alerter `9 passed` + self-check; live upload не выполнялся
  без operator-provided remote/config.

### T06/P-12 dependency audit repair — 27.08.2026

- ✅ Frontend `js-yaml@4.3.2` и `nanoid@3.3.18` закреплены безопасными overrides и
  воспроизводимым lockfile; добавленные WASM-записи Tailwind проверены как optional bundled.
- ✅ В `.github/workflows/ci.yml` добавлены `uv run --extra dev --with pip-audit==2.9.0 pip-audit -l` и
  `npm audit --audit-level=high`; существующие application gates не изменены, секреты не нужны.
- ✅ Локально: оба npm audit и pip-audit чисты, YAML валиден, frontend test `38/38`, lint и build зелёные.

### Точечный repair FE-02/R03, INF-02/04/05, P-12 — 27.08.2026

- ✅ Browser API consumers переведены на `CLIENT_API_BASE` с same-origin default; production Compose передаёт одинаковый `API_URL_INTERNAL` в frontend build arg и runtime env.
- ✅ Каждый backup-снапшот теперь содержит logical `pg_dump` и обязательный physical `pg_basebackup` через `REPL_USER`/`REPL_PASSWORD`; `backup-timer` получает те же credentials.
- ✅ Offsite принимает только rclone `type=crypt` (и отвергает `no_data_encryption=true`); добавлены MinIO health и ClamAV PING/PONG probes с aggregate-state алертера.
- ✅ Проверки: backend `282 passed`, frontend `39/39` + lint + production build, `mypy app`, `pip-audit`, `npm audit`, targeted ruff, shell syntax, alerter `14 passed` и infra-contract `4 passed` зелёные.
- ⚠️ Production Docker build остановлен Docker Desktop на frontend `COPY node_modules` с `no space left on device`; images/volumes не удалялись. Общий `ruff check .` также сохраняет 5 baseline-ошибок в старых миграциях 0007/0009/0010/0013/0027.
- ⏸️ Изменения оставлены незакоммиченными и не отправлялись; live offsite/PITR smoke требует operator-provided crypt remote/config и свободного Docker storage.

### M0 repair round — 27.08.2026

- ✅ Исправлена идемпотентность `archive_command`: наличие уже архивированного WAL
  теперь считается успешным завершением, и rehearsal использует тот же контракт.
- ✅ Production требует `REPL_PASSWORD`, MinIO backup работает fail-closed; добавлены
  crypt/no-data-encryption guard и непрерывный `wal-offsite` sidecar с отдельным age-aware marker.
- ✅ Алертер проверяет свежесть offsite WAL; CI запускает infra alerter tests и Ruff для
  `infra/alerter`; добавлены contract tests для новых guards и негативных remote cases.
- ✅ Быстрые проверки: alerter/infra `24 passed`, shell syntax, Compose config и diff checks зелёные.
- ✅ Полный backend `286 passed`, frontend `39/39` + lint/build; Ruff/mypy, shell syntax,
  Compose config и graph rebuild зелёные.
- ✅ Точный CI-порядок backend (`infra/alerter/test_alerter.py` + `tests`) дал `302 passed`;
  `pip-audit` и `npm audit --audit-level=high` уязвимостей не нашли; graphify повторно собран.
- ⏳ Production smoke по-прежнему требует свободного Docker storage и operator-provided
  crypt remote/config; изменения остаются незакоммиченными.

### Финальное исправление инфраструктуры — 27.08.2026

- ✅ Production backup перед `mirror/list` идемпотентно создаёт или проверяет
  MinIO bucket через `mc` и Python fallback; строгий режим сохраняет fail-closed
  при реальной ошибке.
- ✅ Production entrypoint подготавливает WAL-каталог на новом и существующем
  томе с владельцем `postgres`; dev primary получает `REPL_USER`/`REPL_PASSWORD`/
  `REPL_SLOT`, а backend ждёт `minio` в состоянии `service_healthy`.
- ✅ Общий crypt-guard и backup fallback отвергают `true`/`1`/`yes`/`on` без
  вывода rclone-конфигурации; WAL-sidecar пишет `warn no-wal`, удаляет только
  старые сегменты после успешной отправки, валидирует положительный
  `WAL_ARCHIVE_KEEP_DAYS` и использует WAL volume в режиме `rw`.
- ✅ Runtime-скрипты backup/cron/alerter встроены в production backend image;
  operational bind mounts из checkout намеренно сохранены для совместимости со
  старыми image при rollback. Поэтому rollback требует совместимой ревизии
  checkout/скриптов и не является live-verified свойством. Bind mounts исходников
  приложения отсутствуют; исторические PostgreSQL config/init/entrypoint mounts
  остаются отдельным ограничением.
- ✅ `_env_float` отклоняет NaN и Infinity; добавлены focused и infra-contract
  тесты. На текущем этапе: `47 passed`, targeted Ruff и shell syntax зелёные.
- ✅ `docs/СЕРВЕР-ТРЕБОВАНИЯ.md`, `README-DEPLOY.md`, `RUNBOOK-DATA.md` и
  production env example описывают актуальные API/WAL/storage-probe/Telegram
  параметры, crypt-only offsite и встроенные в image sidecar-скрипты.
- ✅ Финальные gates: полный backend `305 passed`; точный CI-порядок
  `infra/alerter/test_alerter.py` + `tests` — `325 passed`; frontend `39/39`,
  lint и build зелёные; pinned `pip-audit`, `npm audit`, Compose config и
  Dockerfile `buildx --check` уязвимостей/ошибок не нашли.
- ⏳ Live production backup/offsite/PITR smoke не выполнялся: для него нужны
  operator-provided crypt remote/config и отдельный production-like прогон.
  `.graphify` artifacts обнаружены изменёнными до этой работы и не трогались;
  коммит и push не выполнялись.

### M0 hardening verification follow-up — 27.08.2026

- ✅ Pre-migration backup теперь дополнительно фиксирует `BACKUP_RUN_ID` из image
  tag в атомарном `BACKUP_PRE_MIGRATION_MARKER`; поздняя backend-реплика не создаёт
  последовательный дубль, а новый image tag запускает новый backup.
- ✅ WAL-offsite исключает `.tmp`, `.partial` и скрытые частичные файлы из remote
  копирования; alerter не блокируется unhealthy `wal-offsite`, чтобы сообщать его
  ошибку через marker/Telegram.
- ✅ Focused `infra/alerter/test_alerter.py` + `tests/test_infra_contracts.py`:
  `65 passed`; полный `uv run pytest -q`: `315 passed`; объединённый CI-порядок
  `infra/alerter/test_alerter.py` + `tests`: `343 passed` (только upstream
  deprecation warnings).
- ✅ `uv run mypy app`, targeted Ruff включая `infra/backup-lock.py`, shell syntax,
  обе Compose `config --quiet`, Dockerfile `buildx --check` и `git diff --check`
  зелёные.
- ⏳ Live production backup/offsite/PITR smoke по-прежнему требует operator-provided
  crypt remote/config и свободного Docker storage; коммит/push не выполнялись.

### PostgreSQL network/auth contract repair — 27.08.2026

- ✅ Dev Compose закреплён на отдельном `172.31.0.0/24` (`tz-dev-network`), production
  сохранён на `172.30.0.0/24`; общий `pg_hba.conf` разрешает app/replication только
  из этих точных CIDR.
- ✅ Локальный `trust` удалён: роль `postgres` обслуживается через `peer`, app и
  replication используют `scram-sha-256`; primary init/existing-volume и healthchecks
  передают пароль только через runtime environment, replica использует passfile и тот
  же ограниченный HBA.
- ✅ `ensure-replication.sh` и оба restore-пути используют password environment без
  секретов в argv; добавлены contract tests для CIDR/HBA/auth wiring.
- ✅ Targeted `tests/test_infra_contracts.py infra/alerter/test_alerter.py`: `71 passed`.
- ✅ Финальные shell syntax, dev/prod Compose `config --quiet`, targeted Ruff и
  `git diff --check` зелёные; backup/restore fallback не передают пароль в argv.
- ⏳ Live recreate существующей dev-сети не выполнялся; Docker volumes/images не
  затрагивались.

### PostgreSQL primary healthcheck repair — 28.08.2026

- ✅ В dev/prod primary healthcheck добавлен общий
  `infra/postgres/check-primary-health.sh`: `REPL_SLOT` проверяется по допустимому
  формату, SQL с `:'slot'` передаётся через stdin, а `-v slot=...` задаёт ровно
  настроенный слот; пароль передаётся только через `PGPASSWORD` environment.
- ✅ Replica healthcheck сохранён с `pg_is_in_recovery()` и streaming receiver;
  добавлен regression contract, который запрещает `:'slot'` в `-c` и проверяет
  stdin/parameterized форму с fake psql.
- ✅ Dev/prod Compose `config --quiet`, bash/sh syntax, targeted Ruff,
  `git diff --check`, изолированная helper-проверка и `infra/alerter/test_alerter.py`
  (`28 passed`) зелёные.
- ⚠️ Полная команда `uv run pytest -q tests/test_infra_contracts.py
  infra/alerter/test_alerter.py` остановлена session fixture: уже запущенный
  `tz-pg-primary` отклоняет Docker Desktop bridge-адрес `192.168.65.1` по
  текущему `pg_hba.conf`; recreate намеренно не выполнялся.
- ⏳ Runtime smoke после обновления контейнера остаётся за оркестратором;
  volumes/images и `.graphify` не трогались, commit/push не выполнялись.

### Docker Desktop dev HBA repair — 28.08.2026

- ✅ HBA разделён по контурам: production Compose продолжает монтировать только
  строгий `postgres/pg_hba.conf` для `172.30.0.0/24`; dev Compose монтирует
  `postgres/pg_hba.dev.conf` для `172.31.0.0/24` и ограниченного Docker Desktop
  gateway `192.168.65.0/24` (включая observed `192.168.65.1`). Во всех host
  правилах применяется `scram-sha-256`; `trust` и any-address отсутствуют.
- ✅ Добавлены contract-проверки отсутствия gateway в production HBA/Compose,
  наличия SCRAM-only gateway policy в dev HBA и обоих dev mounts. Документация
  содержит безопасный recreate только `pg-primary`/`pg-replica` без `down -v`.
- ✅ Локально: dev/prod `docker compose config --quiet`, shell syntax, targeted
  Ruff и `git diff --check` зелёные; `pytest --noconftest -q
  tests/test_infra_contracts.py` — `48 passed`.
- ⏳ Обычный pytest всё ещё блокируется запущенным контейнером со старым HBA;
  recreate и runtime smoke намеренно не выполнялись. Volumes/images, `.graphify`,
  commit и push не трогались.

### PostgreSQL replication credential repair — 28.08.2026

- ✅ Root cause: `ensure-replication.sh` передавал password в `psql` через
  самодельное экранирование метакоманды `\set`; это не является надёжным
  transport для полного допустимого значения password. Теперь `psql \getenv`
  читает credential непосредственно из runtime environment, а значение не
  попадает в argv, source SQL или логи. После `ALTER ROLE` primary проверяет
  SCRAM-вход самой replication-ролью.
- ✅ Primary healthcheck ждёт marker, создаваемый только после credential
  verification и slot; entrypoint удаляет stale marker перед каждым стартом.
  Replica атомарно создаёт passfile с mode `0600`; путь параметризован только
  для изолированного test harness, production default сохранён.
- ✅ Добавлены executable tests: passfile с `:`/`\\`/`"` и disposable
  PostgreSQL (`tmpfs`, без persistent volume) подтверждает `\getenv` →
  `ALTER ROLE` → реальный SCRAM login. Isolated infra contracts: `50 passed`,
  обычный focused pytest с session fixture: `78 passed`; shell syntax, Compose
  config и `git diff --check` зелёные.
- ✅ Без recreate применён новый idempotent provisioner к текущему dev primary:
  verification credential прошла, replica `pg_is_in_recovery()` и streaming
  receiver подтвердились, passfile остался `0600`; оба текущих DB-контейнера
  перешли в `healthy` без recreate.
- ⚠️ `REPL_PASSWORD` dev-default изменён относительно исторического volume:
  startup теперь конвергирует роль к текущему общему значению primary/replica.
  Для важного dev-volume надо задать явную переменную перед recreate; в
  production default по-прежнему отсутствует. Volumes/images/secrets,
  `.graphify`, commit и push не трогались.

### Final production infra findings repair — 28.08.2026

- ✅ Healthcheck `backup-timer`, `wal-offsite` и `alerter` больше не использует
  `test -s /proc/1/cmdline`: procfs pseudo-file имеет нулевой reported size.
  Проверка использует `kill -0 1` и наличие required runtime script; regression
  contract подтверждает отсутствие procfs-size проверки и соответствие всех трёх
  сервисов списку `HEALTH_SERVICES` в deploy health-gate.
- ✅ `deploy.sh` сохраняет автоматическую генерацию для пустых/`change_me*`
  JWT/NextAuth values, теперь через 32 random bytes (256-bit hex), и fail-closed
  отклоняет operator-supplied placeholder, значение короче 32 символов, whitespace
  или недостаточно разнообразное значение. Preflight никогда не выводит значение;
  shell-contract покрывает generation и `password`/`default`/short rejection.
- ✅ WAL offsite передаёт rclone явный список только завершённых 24-hex WAL и
  8-hex `.history` объектов. History-файлы участвуют в local retention даже без
  remote; hidden, temp, partial и невалидные имена не копируются и не удаляются.
- ✅ Проверки: `bash/sh -n` для изменённых scripts, production Compose config с
  env example, `pytest --noconftest -q tests/test_infra_contracts.py` — `56 passed`,
  `pytest -q infra/alerter/test_alerter.py` — `28 passed`, targeted Ruff и
  `git diff --check` зелёные.
- ⏳ External production backup/offsite/PITR smoke остаётся pending: нужен
  operator-provided crypt remote/config и отдельный production-like прогон.
  Docker volumes/images, `.graphify`, commit и push не трогались.

## i.moscow Product Patterns — Autopilot (05.08.2026)

- ✅ Исправлен референс: актуальная айдентика i.moscow зафиксирована как изумрудная; прежнее описание красной палитры признано ошибочным.
- ✅ Опубликовано дополнение к спецификации: `.scratch/imoscow-product-patterns/spec.md`.
- ✅ Опубликованы 8 вертикальных тикетов: P0 — маршрут проекта, результат оценки, статусы, карточки, фильтры и визуальный проход; P1 — каталог возможностей.
- ✅ Подготовлен handoff-промпт: `.scratch/imoscow-product-patterns/IMPLEMENTATION_PROMPT.md`.
- ⏸️ Реализация начинается после завершения основной Friday Release Candidate, чтобы модели не меняли общие ветки параллельно.
- ✅ Тикеты доведены до исполнительного уровня: добавлены обязательное демо, тестовые швы и явные запреты scope.
- ✅ Создан deferred backlog из 8 направлений будущего глубокого разбора инструментов i.moscow.
- ✅ Handoff-промпт запрещает смешивать deep dive с текущей реализацией без новой спецификации.

## Friday Release Candidate — реализация (05.08.2026)

- ✅ **Тикет 01 «Аудит и baseline» — done.** Baseline-отчёт: `.scratch/friday-release-candidate/baseline-audit.md`.
  - Backend `codex/recovery-backend @ 779c6ac`: ruff чист, **97/97 pytest**; миграции 0015 head (dev+test); 17 API-роутеров; 23 таблицы; live: health/ready/register 200, защищённые 401.
  - Frontend `codex/recovery-frontend @ 8d51882`: lint/tsc/build зелёные (33 маршрута); node-тесты 4/5 — падает stale-ассерт `const statCards` (`tests/ui-shell.test.mjs` №5; страница честная — значения из API), фикс в тикете 02.
  - Infra: compose валиден (local: pg primary+replica; prod: backend/db/frontend/nginx); **MinIO/Redis/ClamAV отсутствуют** (тикеты 06/18).
  - Главные расхождения: **публичные реестры (registry, nioktr) требуют auth — 401 для посетителей** (спека US 6–14; тикеты 10/11); профили/организации/приглашения/официальный УГТ≤2/комментарии/PDF/приватность/realtime/3 темы/demo reset/backup/load-harness — missing (тикеты 03–22).
  - Пользовательские незакоммиченные изменения (main, frontend `.hermes/`) не тронуты.
- ⏸️ Следующий тикет: **02 — безопасная очистка репозитория** (включая фикс stale-теста ui-shell).

## Friday Release Candidate — реализация (05.08.2026)

- ✅ **Тикет 03 «Личные профили и организации» — done.** Backend `c244b9c` (codex/recovery-backend): миграция 0016 (`user_profiles` draft/pending/verified/rejected, `user_organizations`, `organization_members` — многочленство), роутер `profiles.py` (профиль: просмотр/редактирование/отправка; организации: создание/вступление/редактирование/отправка; менеджерские очереди и решения verify/reject с обязательным комментарием), каталог исполнителей только с verified-профилями. **107/107 pytest, ruff чист**. Frontend `fa79bbd` (codex/recovery-frontend): страница `/dashboard/profile` (профиль + организации) и очередь проверки в ЛК менеджера; lint/tsc/build зелёные, node-тесты 5/5. Браузерный E2E: регистрация → профиль draft → сохранение → «На проверке» → очередь менеджера → Подтвердить → verified + empty-state.
- ⏸️ Следующий тикет: **04 — проектные роли, приглашения и договорное владение**.

## Friday Release Candidate — реализация (05.08.2026)

- ✅ **Тикет 04 «Проектные роли, приглашения и договорное владение» — done.** Backend `918f25e` (codex/recovery-backend): миграция 0017 — `project_invites` (single/bulk: max_uses, expires_at, revoked_at, allowed_roles), `project_members.is_project_admin`, договорные поля `projects.legal_*`; API `invites.py`: создание/список/отзыв приглашений, accept (проверка срока/лимита/ролей — 409/403), transfer-admin (создатель теряет полномочие после передачи), legal — только менеджер; создатель автоматически owner+admin. **114/114 pytest, ruff чист**; live-E2E: invite 201 → accept 200 → reuse 409 → transfer 200 → old-admin 403 → legal user 403 / manager 200. Frontend `963091a` (codex/recovery-frontend): панель «Команда проекта» в карточке (приглашения со ссылками `/join/INV-…`, отзыв, передача admin, договорные поля для менеджера), join-клиент различает INV-токены (`/invites/accept`) и join-токены (`/projects/join`). Браузерный E2E: создание приглашения через UI, join INV-токеном → 403 «Роль не разрешена приглашением».
- ⏸️ Следующий тикет: **05 — опросник и официальный УГТ до 2**.

## Friday Release Candidate — реализация (05.08.2026)

- ✅ **Тикет 05 «Опросник и официальный УГТ до 2» — done.** Backend `29ca153` (codex/recovery-backend): `create_assessment` — preliminary ≤ 2 → `auto_confirmed` с `current_level=preliminary`; preliminary 3–9 → официальный **cap на 2** (US 35), статус draft (первичное подтверждение выше — менеджер); audit `project.auto_confirmed`/`project.capped_at_2`; переоценка запрещена после присвоения официального уровня. **121/121 pytest, ruff чист** (7 новых тестов `test_official_ugt.py`, обновлены 11 старых в `test_new_core.py` под новую модель). Frontend `038455c` (codex/recovery-frontend): статус «Подтверждён автоматически» во всех ЛК; карточка показывает официальный УГТ и отдельно «Предварительный: УГТ N» (US 11). Браузерный E2E: проект preliminary 1 → карточка «Подтверждён автоматически · УГТ 1»; preliminary 7 → «Черновик · УГТ 2» + «Предварительный: УГТ 7».
- ⏸️ Следующий тикет: **06 — безопасное файловое хранилище** (MinIO, MIME, ClamAV).

## Friday Release Candidate — реализация (05.08.2026)

- ✅ **Тикет 06 «Безопасное файловое хранилище» — done.** Backend `056ed9f` (codex/recovery-backend): сервис `file_storage.py` — фактический MIME по сигнатуре (PDF/DOCX/XLSX/PNG/JPEG), лимит 25 МБ, внутренние UUID-имена, SHA-256, MinIO (закрытый бакет, авто-создание; диск в тестах), clamd INSTREAM (только clean = доказательство); API `files.py` — upload (multipart)/список/download (infected → 409)/rescan, публичных MinIO URL нет; миграция 0018 (storage_key/file_name/file_size/mime_type/sha256/scan_status в `project_documents` + индексы); compose local+prod: minio + clamav (arm64: mkodockx/docker-clamav:alpine, зеркала FreshClam). **129/129 pytest, ruff чист** (8 новых тестов). Frontend `9bc3d4e` — панель «Файлы проекта» в карточке (загрузка, статус антивируса, скачивание). Live: PDF → MinIO → download байт-в-байт, версии; clamd недоступен → `scan_status=error` (fail-safe, не clean). ⚠️ FreshClam CDN блокирует среду разработчика (403) — живой EICAR-тест перенесён на серверный стенд (клиент и compose готовы).
- ⏸️ Следующий тикет: **07 — универсальные комплекты и автозаявка** (перевод stage-documents на файлы).

## Friday Release Candidate — реализация (05.08.2026)

- ✅ **Тикет 07 «Универсальные комплекты и автозаявка» — done.** Backend `bb1e0f2` (codex/recovery-backend): миграция 0019 — `promotion_request_documents` (неизменяемый снимок версий документов заявки) + `stage_requirements.template_version=v1`; `stages.py`: единый хелпер `_trigger_application` (автотриггер полного комплекта, триггер не зависит от автора), новый роут `POST /projects/{id}/stage-document-file` (multipart; MinIO+ClamAV; только scan_status=clean засчитывается и инициирует заявку), guard US 56 — неизменённый отклонённый комплект не создаёт дубликат (409, сравнение по sha256 на требование), `uploaded` только для clean-файлов. **135/135 pytest, ruff чист** (6 новых тестов `test_requirement_sets.py`). Frontend `202e55b` — stage-progress-panel: файловая загрузка (PDF/DOCX/XLSX/PNG/JPEG ≤25 МБ), версия справочника в UI, список обязательных/загруженных/отсутствующих.
- ⏸️ Следующий тикет: **08 — менеджерская верификация УГТ** (структурированный отказ, N→N+1, история).

## Friday Release Candidate — реализация (05.08.2026)

- ✅ **Тикет 08 «Менеджерская верификация УГТ» — done.** Backend `6082bb6` (codex/recovery-backend): первичное подтверждение — guards level ∈ [2, preliminary] (400 при понижении ниже УГТ 2 / превышении заявленного, US 59/60); повышение строго N→N+1 от текущего уровня (устаревшая заявка → 409, рассмотренная → 404); структурированный отказ `missing: list[str]` → `evaluation_result.missing_required` + audit; история попыток менеджерская и неизменяема (US 55). **143/143 pytest, ruff чист** (8 новых тестов `test_manager_verification.py`). Frontend `c1bc879` — при отклонении заявки менеджер вводит недостающие материалы.
- ✅ **Тикет 09 «Комментарии, PDF-заключение, очистка версий» — done.** Backend `5a0cee1` (149 pytest): миграция 0020 (`request_comments`, US 53); PDF-заключение (reportlab+кириллица); retention версий с защитой снимков заявок; Dockerfile +fonts-dejavu-core. Frontend `9b7d449` — панель обсуждения заявок и PDF.
- ✅ **Тикет 10 «Публичная карточка, реестры, приватность» — done.** Backend `a558d18` (155 pytest, миграция 0021): согласие на публикацию (auto_confirmed для УГТ 1–2, approved/published для 3–9), реестр по `is_public`, preliminary опционально, `?ugt_min=7` = реестр технологий. Frontend `dd3dbfe` — блок публикации в карточке.
- ✅ **Тикет 11 «Реестры специалистов, организаций и НИОКТР» — done.** Backend `3620d80` (156 pytest, миграция 0022): раздельные реестры специалистов (verified-only) и организаций, НИОКТР отдельно с source/imported_at, идемпотентный импорт. Frontend `53dc371` — вкладки каталога.
- ✅ **Тикет 12 «Realtime-уведомления» — done.** Backend `ad65907` (161 pytest, миграция 0023): outbox, SSE, атомарный claim (SKIP LOCKED), реassign админа. Frontend `5eced89` — колокольчик со звуком.
- ✅ **Тикет 13 «Архивирование, аудит, экспорт» — done.** Backend `01a12a0` (165 pytest): delete пустых черновиков, archive верифицированных, глобальный append-only аудит, JSON-экспорт. Frontend `ec5f130` — кнопки в карточке.
- ⏸️ Следующий тикет: **14 — отказоустойчивый AI-консультант**.

## Friday Release Candidate — реализация (05.08.2026)

- ✅ **Тикет 02 «Безопасная очистка» — done.** Frontend `85042c4` (codex/recovery-frontend): удалён мёртвый `_role-dashboard.tsx` (0 импортов), стартовые svg `public/{next,vercel,globe,file,window}.svg` (0 ссылок, favicon.ico сохранён); stale-тест `ui-shell.test.mjs` №5 переписан на проверку поведения — **node-тесты 5/5**, lint/tsc/build зелёные. Docs `friday-release-candidate`: удалены `КОД MVP "0"/{download,tool-results,upload}` (128 файлов: tool-артефакты, скриншоты, zip+extracted-дубль) и `.zscripts/dev.pid`. Backend: мусора не найдено (все .py используются). Пользовательские `.hermes/` и изменения в main не тронуты.

## Friday Release Candidate — Autopilot (05.08.2026)

- ✅ Глубокое интервью завершено; конечное видение и приоритеты подтверждены Functional Validator.
- ✅ Главный тестовый шов согласован: полный black-box сценарий через браузер/API/файлы; внутренние тесты — поддерживающий слой.
- ✅ Спецификация опубликована: `.scratch/friday-release-candidate/spec.md` (`Status: ready-for-agent`, 108 user stories).
- ✅ Спецификация согласована командой Functional Validator «Теперь тикеты».
- ✅ Local Markdown tracker и single-context domain rules настроены в `docs/agents/`.
- ✅ Phase 3: 22 вертикальных тикета опубликованы в `.scratch/friday-release-candidate/issues/` по решению Functional Validator передать реализацию другой модели.
- ✅ Master handoff prompt опубликован: `.scratch/friday-release-candidate/IMPLEMENTATION_PROMPT.md`.
- ⏸️ Реализация не начата текущим агентом; следующий исполнитель начинает с тикета 01. Текущий агент вернётся для финального ревью.

**MVP1 «Технозрелость» — готов к сдаче 31.08.2026** (пайплайн: спека → тикеты → реализация → QA)

## Актуальная фаза (03.08.2026)
- ✅ Интервью-продолжение (19 решений) завершено — лог: `.scratch/mvp1-release/interview-log.md`
- ✅ **Спека обновлена** (`.scratch/mvp1-release/spec.md`, 03.08): новое ядро продукта — экспресс-оценка УГТ любым пользователем → проект-черновик → апрув менеджера (присвоение официального УГТ) → два реестра (общий + технологии УГТ 7+) → автозаявка на повышение N→N+1 по полноте комплекта документов → предварительная оценка по ГОСТам → верификация менеджером. Роль «Эксперт УГТ» → **«Регулирующая организация»** (join по токену → документы подтверждения). Демо-маршрут №18, критерии приёмки №19 (чек-лист 6 шагов).
- ✅ **Тикеты 20–31 опубликованы** (`.scratch/mvp1-release/issues/`): 20 схема БД → 21–25 API (экспресс-оценка, очереди менеджера, этапы/автозаявка, реестры, верифицирующие документы) → 26–30 фронтенд → 31 сквозные тесты + демо №18 + QA
- ✅ **Дизайн-система v1** (`DESIGN.md` + роллаут токенов в Tailwind v4): палитра OKLch на гамме бренда, типографика PT Serif (display) / Inter (body) / JetBrains Mono (ID/УГТ/цифры), компонентный слой `tz-*`, правила (один акцент ≤2×, без эмодзи, честные empty-state). Проверено: lint + tsc + production build (23 маршрута) зелёные
- ✅ **Тикеты 26–30 — дизайн-слой фронтенда**: «Оценить УГТ» во всех 9 ЛК (+ счётчик черновиков, маршрут опросника открыт любой роли); ЛК менеджера — две очереди («Новые проекты» / «Заявки на повышение», счётчики, честные empty-state до API); реестр — переключатель «Проекты / Технологии УГТ 7+» + фильтры в новой системе; карточка проекта — шапка с УГТ-бейджами и статусом; роль переименована в «Регулирующая организация» (display-слой)
- ✅ **Тикеты 20–25 реализованы и запушены**: миграция 0010, словарь 8 этапов N→N+1, экспресс-оценка, очереди менеджера, автозаявка с LLM-предоценкой по ГОСТам, общий реестр, верифицирующие документы и роль `regulating_organization`. Backend: `de9923e`, 79/79 pytest, ruff clean.
- ✅ **Фронтенд-привязка к API нового ядра запушена** (`9586d79`, codex/recovery-frontend): визард → `POST /assessments`, черновики через `/assessments/mine`; ЛК менеджера → `/manager/queue/drafts` + `/manager/queue/promotions` (approve/reject, причины, счётчики, empty states); реестр → `/projects/registry` (+ фильтры ugt_min/ugt_max/category/budget); карточка проекта → stage-progress-panel (требования N→N+1, загрузка, предварительная оценка, автозаявка); verification-docs-panel для регулирующей организации; фикс Auth.js `trustHost` (был сломан весь вход — UntrustedHost)
- ✅ **API-QA нового ядра пройден на живых данных** (03.08): экспресс-оценка → черновик (проекты 9, 10); approve черновика менеджером → published + УГТ 3; требования этапа 3→4 → загрузка документа → **автозаявка автоматически** (`pending_manager`, оценка `evaluation_success: true`, уведомление менеджеру) → approve → УГТ 4; заявка 4→5 → reject с причиной (уровень не изменился, история попыток `attempt_no`); регулирующая организация: регистрация → join по токену TZ-… → approve менеджером → verification-doc загружен → виден менеджеру в заявке; реестр: только published + фильтры работают; запрет переоценки существующего проекта (409)
- ✅ **Визуальный QA в браузере (03.08, завершён)**: вход менеджером → очереди (9 черновиков + заявка) → апрув заявки №3 через UI («Подтвердить» → счётчик 1→0, empty-state, проект 13: УГТ 1→2, published) → ЛК регулирующей организации (список загруженных документов из карточки) → секция «Верифицирующие документы» в карточке проекта. Ложная тревога «кнопка не работает» = клик уходил мимо кнопки ниже области видимости (не баг продукта)
- ✅ **Дефект verification-docs закрыт**: `verification_documents` в карточке проекта (`GET /projects/{id}`), пустой список по умолчанию; владелец/участники видят документ (проверено на проекте 13: vdoc id=2 «Подтверждение УГТ 1785755323»). Backend: `8e13f84`, 80/80 тестов
- ⚠️ Dev-пифолл: `npm run build` при живом dev-сервере ломает NextAuth-роуты (зависание логина) — перезапускать dev после build с `rm -rf .next`

## Push-контракт
- Remote `origin` → `https://github.com/atrshncv-design/MVP-CNTR.git`
- Backend: `codex/recovery-backend` — тикеты 20–25 запушены (последний: `de9923e`)
- Frontend: `codex/recovery-frontend` — все тикеты запушены (`4daf351` → `9c67ca9`)
- Документация: `main` — спека/журнал/статус (03.08)

## Прогресс тикетов (спека: `.scratch/mvp1-release/spec.md`)
- ✅ 01–11: инфраструктура, тесты, схема вступления, RBAC, проекты, join-механика, генерация, AI-ассистент (OpenAI-совместимый), ГОСТы в RAG (456 чанков), НИОКТР (400 карточек/188 орг.), реестры API
- ✅ 12–14: фронтенд — визард→сохранение→карточка, ЛК всех 9 ролей (JoinProjectForm, КТ-решения, админ-пользователи), ассистент (источники с УГТ/разделами ГОСТов), реестры (компетенции, организации, фильтры)
- ✅ 15: профиль + администрирование (пароль, пользователи, роли, деактивация)
- ✅ 16: семантические дизайн-токены (--tz-*) в globals.css
- ✅ 17: 66 интеграционных/юнит-тестов (включая полный демо-маршрут) — зелёные
- ✅ 18: production-стек (Dockerfile'ы, compose, nginx+HTTPS, deploy.sh, README-DEPLOY)
- ✅ 19: ручной QA в браузере — сквозной сценарий ГК подтверждён (см. ниже)

- ✅ 20–25: backend нового ядра — миграция 0010, экспресс-оценка, очереди менеджера, автозаявка N→N+1, общий реестр, документы верификации; 79 тестов зелёные
- ✅ дефект-фикс (QA open-design): `verification_documents` видны владельцу и участникам в карточке проекта (`GET /projects/{id}`), пустой список по умолчанию; 80 тестов зелёные, backend :8000 поднят
- ✅ **Публичный посадочник** (frontend `775ec99`): многостраничник на дизайн-системе 2.0 — hero с УТП, «Как это работает», 9 ролей, шкала УГТ 1–9 + детальные страницы уровней, о центре, методика, заказчики, исполнители, дорожная карта; RSC, auth-aware навигация, без моков; lint+tsc+build зелёные, браузерный QA пройден (вход менеджером → «Войти в личный кабинет»)
- **Пифолл (зафиксирован):** `npm run build` при живом dev-сервере ломает NextAuth-роуты (зависает логин) → останавливать dev, потом `rm -rf .next` и dev заново
- ✅ **Аудит фронта×бэкенд (задача open-design D1–D6, коммиты `99046bf`+`c5e8054`)**: investor/serial_manufacturer переведены на `projects/registry?ugt_min=7` (RegistryProjectOut, бюджет, статик-бейдж «В реестре»); маршрут роли `ugt_expert`→`regulating_organization` (папка переименована, roles.ts, проверено логином в браузере); API_URL fallback единый `127.0.0.1:8000`; NEXTAUTH_SECRET реальный (`.env.local`, не коммитится). **D1 не дефект**: инверсия slate/gray/neutral уже есть в `.dark` дизайн-системы 3.0 (строки 158–195 globals.css), маппинг через `var(--tz-p-*)`; дашборды сейчас светлые (ThemeToggle только в лендинге) — вопрос «тёмные ли ЛК» открыт дизайнеру. **D4 не дефект**: `api-client.ts` используется страницей `projects/page.tsx`. Gates: lint+tsc+build зелёные

- ЛК менеджера: две очереди («Новые проекты» + «Заявки на повышение УГТ»)
- Автозаявка на повышение УГТ при полноте комплекта документов этапа (N→N+1, 8 этапов)
- Словарь документов этапов: LLM по ГОСТам один раз → верификация методологом центра [PLACEHOLDER]
- Роль «Регулирующая организация» (join по токену → верифицирующие документы → материал для менеджера)

## Ручной QA (браузер, тикет 19) — подтверждено
- Регистрация (9 ролей) + вход + ЛК ГК с реальными данными
- Визард: 9 уровней → радар → «Сохранить проект» → редирект `/dashboard/project/8`
- Карточка: токен `TZ-7L68Q6`, КТ-1…КТ-4, «Копировать», «Заявки на вступление»
- Генерация ТЗ из карточки — чистый документ (без `{{...}}`), название проекта в тексте
- Чат: живой LLM-ответ по ГОСТ Р 58048-2017 (nemotron-3-ultra-free)
- Найден и исправлен баг: отсутствие SessionProvider в root layout (падали все дашборды) — `9c67ca9`

## Окружение (локально)
- PostgreSQL: docker compose (primary 5432, replica 5433), миграции на head (0009)
- Backend: uvicorn :8000 (все эндпоинты проверены живьём: health/ready/реестры/генерация/чат)
- LLM: `LLM_API_BASE=https://opencode.ai/zen/v1`, `LLM_MODEL=nemotron-3-ultra-free`, ключ в `.env`
- RAG: 456 чанков ГОСТов + шаблоны tz/passport/teo + выборка НИОКТР

## Следующие шаги
- Тикеты по спеке 03.08 (новое ядро: экспресс-оценка, очереди менеджера, автозаявка, регулирующая организация)
- Реализация новых механик → тесты → QA демо-маршрута №18
- Деплой на сервер коллег: `cd technozrelost-backend && ./infra/deploy.sh` (инструкция: `infra/README-DEPLOY.md`)
- Дизайн-проход open-design — после сдачи (по решению Functional Validator)


## Friday Release Candidate — ФИНАЛ (05.08.2026)

✅ **Все 22 тикета закрыты.** Release gate: 190/190 pytest, frontend lint/tsc/5/5/build зелёные, compose/backup/security PASS (известные ecdsa advisory без фикса задокументированы), публичные реестры 200 (B1 закрыт), resubmit отклонённых драфтов. Отчёт: `.scratch/friday-release-candidate/release-gate-report.md`. Ветки: backend `codex/recovery-backend` (head `35594a2`), frontend `codex/recovery-frontend` (head `7a08999`), docs `codex/friday-release-candidate` (head `…`). Развёртывание: `infra/README-DEPLOY.md` (deploy.sh) + seed `uv run python -m app.db.reset_demo --full` на сервере.
