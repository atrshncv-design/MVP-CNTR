# 02 — Backend inventory (static, local checkout f364388)

Источник: статический разбор worktree `production-technical-audit`, HEAD `f364388`
(EV-001). Server-линия `f06b15c` (EV-002) — тот же продуктовый код плюс закрытие
прошлого прогона (Решение 1); пофайловый дифф серверного checkout не выполнялся,
поэтому deployed-утверждения ниже только там, где есть EV-003/EV-004.
Auth-gated runtime на production — `UNKNOWN` (R36).

## Роутеры (26× `include_router`, все под `/api/v1`; `app/main.py`)

| Префикс | Файл | Назначение |
|---|---|---|
| `/auth` | `app/api/v1/auth.py` | register/login/refresh/logout/me; allowlist саморегистрации, троттлинг, атомарный refresh |
| `/projects` | `app/api/v1/projects.py` | CRUD, `/registry`, `/registry/{id}`, publish/archive/export/delete |
| `/projects` | `app/api/v1/requests.py` | заявки, conclusion.pdf, чистка старых версий файлов |
| `/projects` | `app/api/v1/membership.py` | членство в проектах |
| `/projects` | `app/api/v1/stages.py` | stage-requirements/documents/evaluate |
| `/projects` | `app/api/v1/generation.py` | `/{id}/generate/{doc_type}` — генерация документов |
| `/projects` | `app/api/v1/achievements.py` (2-й роутер) | достижения проектов |
| `/nioktr` | `app/api/v1/nioktr.py` | реестр НИОКТР, organizations, лимит `enforce_registry_limit` |
| `/executors` | `app/api/v1/executors.py` | specialists/organizations, роли `rd_executor/scientific_org/serial_manufacturer` |
| `/technologies` | `app/api/v1/technologies.py` | справочник технологий |
| `/assessments` | `app/api/v1/assessments.py` | template/submit/mine (УГТ-контур, готовится к запуску) |
| `/manager` | `app/api/v1/manager.py` | очереди drafts/promotions, decide/revert/history |
| `/news` | `app/api/v1/news.py` | CRUD, publish/schedule/unpublish, categories, mine/admin-list |
| `/notifications` | `app/api/v1/notifications.py` | список, `{id}/read` |
| `/notifications` + `/manager/tasks` | `app/api/v1/realtime.py` | `POST sse-ticket`, `GET stream` (SSE), `POST emit` |
| `/users` | `app/api/v1/users.py` | me/password, admin CRUD ролей, reset-password |
| `/admin` | `app/api/v1/admin.py` | audit, achievements/stats |
| `/achievements` | `app/api/v1/achievements.py` | catalog/mine |
| `/chat` | `app/api/v1/chat.py` | `POST ""`, `/tuno`, `/kaba`, `GET /metrics/ai` |
| `/match` | `app/api/v1/match.py` | LLM-мэтчинг через центр |
| `/rag` | `app/api/v1/rag.py` | templates CRUD, search |
| `/files` (без префикса роутера, полные пути) | `app/api/v1/files.py` | upload/list/download/rescan; сигнатурный MIME, 25МБ, UUID-имена |
| `/profile`, `/orgs`, `/manager/profiles`, `/manager/orgs` | `app/api/v1/profiles.py` | профили/организации, submit/decide |
| `/invites`, `/projects/{id}/invites` | `app/api/v1/invites.py` | invite/accept/revoke/transfer-admin/legal |
| `/health`, `/ready` | `app/api/v1/health.py` | liveness/readiness (replica/redis/storage/clamav) |
| `/metrics` | `app/api/v1/metrics.py` | Prometheus-метрики, метки `(method,route,status)` |

Публичные без auth (static, по коду + EV-004 частично): `/health`, `/ready`,
`/metrics`, `/projects/registry`, landing `/`. Остальное требует JWT.

## Таблицы (36, `app/db/models.py`; миграции 35 ревизий `0001`→`0037`)

Воспроизводимая проверка (blocking review 01): `rg -c '__tablename__\s*=' technozrelost-backend/app/db/models.py` → `36`.

`roles`, `permissions`, `users`, `refresh_tokens`, `projects`,
`questionnaire_results`, `assessment_templates`, `assessment_checkpoints`,
`project_assessments`, `assessment_answers`, `project_members`, `project_invites`,
`control_points`, `project_documents`, `audit_trail`, `rag_documents`,
`organizations`, `stage_requirements`, `request_comments`,
`promotion_request_documents`, `promotion_requests`, `verification_documents`,
`notifications`, `notification_outbox`, `technologies`, `user_profiles`,
`user_organizations`, `organization_members`, `nioktr_cards`, `news_categories`,
`news_tags`, `news_posts`, `news_post_media`, `achievements`, `user_achievements`,
`project_achievements`.

## Фоновые задачи / cron

- `news_scheduler`: `_news_scheduler_loop` в `app/main.py`, интервал 60с
  (`SCHEDULER_INTERVAL_SECONDS`), advisory lock `pg_try_advisory_lock(42)`,
  атомарный `UPDATE ... WHERE status='scheduled' AND scheduled_at <= now()`.
  Источник истины — статус в БД, переживает рестарты.
- Других cron/очередей в коде приложения нет (Celery/ARQ отсутствуют).
  Infra-уровень (backup-timer, wal-offsite) — зона operations-отчёта, здесь только факт.

## Роли (static: `app/core/deps.py`, `app/db/*`, миграции)

- Саморегистрация (allowlist): `gk_customer`, `rd_executor`, `scientific_org`,
  `serial_manufacturer`.
- Привилегированные: `cntr_admin`, `cntr_manager`, `investor`, `auditor`,
  `regulating_organization`/`ugt_expert` (миграция `0010`: downgrade-текст
  переименовывает `regulating_organization`→`ugt_expert`; фронтенд держит оба
  dashboard-сегмента — расхождение зафиксировано в матрице, runtime — UNKNOWN).
- Ролевой runtime на production — `UNKNOWN` до test accounts (R36).

## Флаги / режимы (имена ключей, без значений)

- `LLM_GATEWAY_ENABLED` — LLM-шлюз выключен по умолчанию, включается явно.
- `CLAMAV_ENABLED`, `CLAMAV_HOST/PORT`, `CVD_MAX_AGE_SECONDS` — антивирус fail-closed.
- `MINIO_*`, `REDIS_URL` (prod обязателен, in-memory fallback запрещён),
  `REGISTRY_ANON_LIMIT/AUTH_LIMIT/WINDOW_SECONDS/MAX_ENTRIES`,
  `LLM_TIMEOUT_SECONDS=8.0`, `LLM_QUEUE_TIMEOUT_SECONDS=2.0`, `LLM_MAX_CONCURRENCY=4`.
- Frontend: `getPublicRegistry`/matching — P2-заглушки с 403 `p2GatedMessage`
  (`src/lib/api-client.ts`); публичный реестр идёт через `fetchPublicRegistryPage`.

## Интеграции (имена, без secrets)

PostgreSQL 16/pgvector (primary; replica `not_configured` — EV-004), Redis 7,
MinIO (закрытый бакет), ClamAV 1.4.3, nginx (SSE-лог без query, лимиты зон),
Prometheus v2.54.1 + Grafana 11.2.0, alerter (+Telegram именами), backup-timer,
wal-offsite. Внешних SaaS-интеграций в коде продукта нет.

## Webhooks

Входящих/исходящих продуктовых webhooks в коде нет (поиск `webhook` по
`app/` и `src/` — ноль совпадений). Уведомления — SSE + notification outbox.
Alerter dry-run (`infra/acceptance_alert_dryrun.py`) — infra, не продукт.

## AI-контур (static; eval — зона AI-отчёта)

- Entrypoints: `POST /chat`, `/chat/tuno`, `/chat/kaba`, `POST /match`,
  `POST /rag/search`, `POST /projects/{id}/generate/{doc_type}`.
- Семантика офлайн 1536 (`EMBEDDING_MODEL=semantic-ru-v2`,
  `app/core/embeddings.py`); `wrap_untrusted` + `UNTRUSTED_BEGIN/END`.
- Внутренние AI-контуры — в разработке (граница MVP); их отсутствие не regression.
