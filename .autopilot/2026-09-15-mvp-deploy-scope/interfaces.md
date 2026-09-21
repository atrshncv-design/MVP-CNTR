# Границы — из спецификации (копия раздела «Границы и швы», не редизайн)

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `infra-single` | одноузловой контур, лимиты, TLS, бэкапы, мониторинг | готовность `/ready`, публичный HTTPS, свежесть бэкапа | репликацию, число реплик, ACME-детали |
| `release-p2` | инфоконтур, ЛК, роли, gating реестров и matching | страницы, кабинеты, ролевые действия | скрытые маршруты, внутренние флаги |
| `ai-rag` | корпус ГОСТов, импорт, поиск, чат с цитатами | ответ с источниками, поисковые фрагменты | промпты, чанки, ключ провайдера |
| `release-p3` | публичные реестры и витрина | анонимное чтение проверенных данных | внутренние очереди модерации |
| `acceptance` | нагрузочные и боевые гейты | вердикт pass/fail по каждому пакету | сценарии нагрузки внутри |

Швы для тестов — публичные границы продукта: `GET /api/v1/health`, `GET /api/v1/ready`, публичные страницы по HTTPS, вход и саморегистрация базовых ролей, ролевые кабинеты, загрузка файла с антивирусом, SSE по ticket, RAG-поиск и чат с цитатами, свежесть бэкапа, доставка алерта. Новых швов не вводим.

## Из таска 01 — одноузловая топология

- `/ready` без изменений: Primary `ok`, Replica `not_configured` при пустом `POSTGRES_REPLICA_HOST`
- alerter `check_replica_and_slot` → `ok`/`not_configured` без сети при пустом `replica_host`; пустой `REPL_SLOT` = слот не создаётся и не проверяется
- ClamAV снижен 4G→2G; полная таблица лимитов ≤8 ГиБ — зона таска 04

## Из таска 02 — gating P2

- `P2_PUBLIC_REGISTRIES_ENABLED=false`, `P2_MATCHING_ENABLED=false`, `P2_GATED`, `p2GatedMessage(feature)→string` (`technozrelost-frontend/src/lib/release.ts`)
- `matchOrganizations/postMatch/getPublicRegistry` сохраняют сигнатуры, при выключенном флаге бросают `ApiError` 403 `BLOCKED`
- P3-код matching и витрины оставлен в дереве без роутов и ссылок (включает таск 09)

## Из таска 03 — роли и регистрация

- `POST /users/{id}/reset-password` (staff, body `{new_password}`, ревок сессий, аудит `user.password.reset`)
- `PATCH /users/{id}` и `GET /users` — только staff (`cntr_admin`, `cntr_manager`); схема `PasswordResetIn`
- В живой БД 8 ролей; `ugt_expert` существует только в downgrade 0010

## Из таска 06 — RAG-импорт

- `is_allowed_corpus_file(path)→bool`; `scan_corpus_dir(dir)→CorpusScan`; `build_manifest/read_manifest/write_manifest`; `plan_import/diff_manifests→ImportPlan`; `ensure_allowed_for_external(name)` бросает `ValueError`
- CLI `scripts/rag_import --corpus-dir/--manifest/--dry-run`; повтор без изменений — no-op

## Из таска 04 — ресурсный конверт

- `infra/preflight.py` (env `PREFLIGHT_CPUS/MEM_TOTAL_KB/DISK_AVAIL_KB/DISK_PATH/COMPOSE_FILE`; exit 0/1/2, причины в stderr); `deploy.sh` вызывает preflight до сборки
- Redis `--maxmemory/--maxmemory-policy`, Prometheus `--storage.tsdb.retention.time/size`
- Окно обслуживания вписано в runbook; норматив пилота — README-DEPLOY.md

## Из таска 07 — TLS и гейт деплоя

- `infra/tls_deploy_gate.py` (env `PUBLIC_HOST/NEXTAUTH_URL/CORS_ORIGINS/TLS_CERT_FILE/TLS_KEY_FILE/TLS_MIN_VALIDITY_DAYS`; exit 0/1/2 + stderr)
- `infra/tls_issue.sh` (первичный ACME/standalone); `infra/tls_renew.sh [--dry-run]` (webroot + reload + гейт)
- readiness в deploy — верифицированный `curl https://$PUBLIC_HOST` без `-k`

## Из таска 08 — AI-обвязка

- `ai_wiring.resolve_llm_api_key()→str|None`; `sanitize_question_for_external(str)→str`; `fragment_source_name(title,source_uri)→str`; `select_external_fragments(list)→list`
- `OPENCODE_API_KEY_ENV="OPENCODE_API_KEY"`; маркеры `REDACTED_EMAIL/REDACTED_PHONE`

## Из таска 09 — P3 реестры

- `fetchPublicRegistryPage(afterId?) → {items: RegistryProjectOut[], failed, status}`; анонимный `GET /projects/registry?limit=&after_id=` без Authorization; `SHOWCASE_TEASER_SIZE=3`
- Навигация ведёт в /projects при любом состоянии реестра; gated-заглушки api-client таска 02 не тронуты (matching остаётся закрыт)

## Из таска 10 — приёмка

- `acceptance_load.py run(argv)/verdict()/percentile()/THRESHOLDS` (exit 0/1/2 + JSON-отчёт); `acceptance_alert_dryrun.py run()` (DRY-RUN без сети/секретов)
- `BACKUP_KEEP` 14→7; отчёт переписан (6/11/150, P1/P2/P3, трассировка); `docs/СЕРВЕР-ТРЕБОВАНИЯ.md` помечен отозванным

## Правила прогона (ярус T3 — 10 тасков, 4 волны)

- Стек: Next.js 16 + FastAPI + PostgreSQL 16/pgvector + MinIO/ClamAV/Redis/nginx; прод-контур — одноузловой, без Replica.
- Фактический сервер: 6 vCPU, 11 ГиБ RAM, 150 ГБ SSD; суммарный лимит контейнеров не выше 8 ГиБ.
- Команды проверки: backend-тесты из `technozrelost-backend`, frontend-тесты из `technozrelost-frontend`; RAG-импорт только из allowlist `ГОСТ*.pdf`.
- Не трогать: прод-сиды и демоданные, секреты (только имена, never значения), файл доступов в worktree, исходные PDF корпуса (не коммитить).
- Отсутствующая зависимость → `BLOCKED: <имя>` + причина, молча не ставить.
- Работа строго в изолированном worktree; ветку `main` не ломать; каждый коммит пушить в `origin`.
- Внешнему AI — только фрагменты корпуса ГОСТов и обезличенные вопросы; ПДн, файлы проектов и данные ЛК запрещены.
