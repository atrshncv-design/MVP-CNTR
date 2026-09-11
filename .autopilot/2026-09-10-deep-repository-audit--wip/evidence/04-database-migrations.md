# Evidence 04: база данных, миграции и запросы

## База и метод

- Checkout: `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`, ветка
  `audit/deep-repository-20260910`, 2026-09-10. До аудита worktree уже содержал
  изменения только в `.autopilot/`; продукт не изменялся.
- Статически прочитаны целиком `app/db/models.py`, `app/schemas.py`, Alembic env и
  затронутые revision/SQL-файлы; все 35 wrappers и соответствующие 35 SQL-файлов
  инвентаризированы по lineage, DDL/DML, constraints/indexes и downgrade; grep-поиском
  просмотрены все SQLAlchemy `select/update/delete/insert`, `execute/scalar/all`,
  joins/order/limit, transaction/lock call-sites в `app/`, а затем полностью
  прочитаны затронутые швы API/сервисов.
- Alembic-линия единственная и линейная: `0001` ... `0033` ->
  `0036_semantic` -> `0037`; пропуск номера не является разветвлением.
  `alembic/env.py:28-48` оборачивает revision в транзакцию PostgreSQL.
- Постоянная и тестовая БД не открывались и не изменялись. DB-зависимые pytest,
  включая `tests/test_migration_remediation.py:13-115` и
  `tests/test_performance_indexes.py:40-61`, намеренно не запускались: fixture
  применяет миграции и TRUNCATE (`tests/conftest.py:48-62,73-107`).
- Команда `uv run ruff check app/db/models.py app/schemas.py app/core/database.py
  app/api/v1/projects.py app/api/v1/files.py app/api/v1/invites.py
  app/api/v1/profiles.py app/api/v1/manager.py app/api/v1/news.py
  app/services/rag.py app/services/notifications.py alembic/versions` -> FAIL:
  `Found 10 errors`: E501 в `0007:29`, `0009:29`, `0010:34`, `0013:29`,
  `0029:47`, `0030:40,45`, `0031:36`; B007 в `0027:56`, `0028:54`.
  Повторный запуск выполнен 2026-09-11, код и зависимости не менялись.

## Воспроизводимый полный inventory

Команды inventory: специализированный grep и локальный `rg` недоступны
(`ripgrep execution failed`; `zsh: command not found: rg`), поэтому список ниже
получен полным чтением `app/db/models.py:1-1087`, каталога
`alembic/versions/` и каждого из 35 wrappers. Это одновременно независимый
воспроизводимый перечень ожидаемых элементов: 36 mapped classes, 3 association
tables и 35 линейных revisions.

### Все ORM models и owning migrations

В таблицах ниже сокращения однозначны и воспроизводимы относительно
`technozrelost-backend/`: `models.py` = `app/db/models.py`, `projects.py` =
`app/api/v1/projects.py`, прочие API/service basenames указывают соответствующий
путь под `app/api/v1/` или `app/services/`; `NNNN.py` = `alembic/versions/NNNN_*.py`,
`NNNN...sql` = `db/migrations/sql/NNNN_*.sql`.

| ORM item | Model citation | Owning/evolving migration(s) | Verdict |
|---|---|---|---|
| `Role` | `app/db/models.py:73-91` | `0003_rbac.sql:9-28`; `0010_new_core.sql:105` | Mapped; unique slug/no/type agree |
| `Permission` | `app/db/models.py:94-107` | `0003_rbac.sql:30-40` | Mapped; unique slug agrees |
| `User` | `app/db/models.py:110-130` | `0003_rbac.sql:54-84` | Mapped; PK/FK callers agree |
| `RefreshToken` | `app/db/models.py:141-155` | `0015_refresh_tokens.py:26-34` | Mapped; token unique, user CASCADE |
| `Project` | `app/db/models.py:158-215` | `0004_projects_and_questionnaire.sql:2-15`; wrappers `0006.py:26-36`, `0010.py:26-41`, `0017.py:26-41`, `0021.py:26-39`, `0027.py:26-33`, `0037.py:30-51` | Mapped; status check agrees; order-index gap in matrix |
| `QuestionnaireResult` | `app/db/models.py:218-245` | `0004_projects_and_questionnaire.sql:17-25`; `0030_questionnaire_per_user.sql:5-25`; `0032_questionnaire_read_isolation.sql:8-20` | Mapped; FK action conflict DB-01 |
| `AssessmentTemplate` | `app/db/models.py:248-256` | `0011_readiness_assessment.sql:4-9` | Mapped |
| `AssessmentCheckpoint` | `app/db/models.py:259-273` | `0011_readiness_assessment.sql:11-29` | Mapped; DB uniques/checks richer than metadata |
| `ProjectAssessment` | `app/db/models.py:276-304` | `0011_readiness_assessment.sql:31-50` | Mapped; DB checks richer than metadata |
| `AssessmentAnswer` | `app/db/models.py:307-326` | `0011_readiness_assessment.sql:52-70` | Mapped; DB unique absent from metadata |
| `ProjectMember` | `app/db/models.py:329-351` | `0004_projects_and_questionnaire.sql:29-35`; `0006_join_tokens.py:26-36`; `0017_project_invites_admin.py:26-41`; `0027_performance_indexes.py:26-33` | Mapped; DB `(project,user)` unique |
| `ProjectInvite` | `app/db/models.py:354-380` | `0017_project_invites_admin.py:26-41` | Mapped; token unique; atomic call-site verified |
| `ControlPoint` | `app/db/models.py:383-407` | `0004_projects_and_questionnaire.sql:39-50`; `0009_control_point_decision_width.py:26-34`; `0037_status_checks.sql:31-34` | Mapped; status check agrees |
| `ProjectDocument` | `app/db/models.py:410-446` | `0004_projects_and_questionnaire.sql:53-65`; `0010_new_core.py:26-41`; `0018_file_storage.sql:6-32`; `0037_status_checks.sql:20-23` | Mapped; version uniqueness gap DB-02 |
| `AuditTrailEntry` | `app/db/models.py:449-461` | `0004_projects_and_questionnaire.sql:67-83`; `0008_audit_project_nullable.py:26-34` | Mapped; history is CASCADE-deletable |
| `RagDocument` | `app/db/models.py:464-498` | `0002_rag_documents.sql:6-39`; `0005_rag_metadata.py:26-32`; `0029_rag_contour.sql:8-36`; `0036_semantic_embeddings_reindex.py:33-49` | Mapped; dedup/model-version gaps DB-06/11 |
| `Organization` | `app/db/models.py:501-528` | `0007_organizations_technologies.py:26-35`; `0028_indexes_pagination.sql:16-25` | Mapped; trgm/hash indexes agree |
| `StageRequirement` | `app/db/models.py:531-542` | `0010_new_core.sql:6-34`; `0019_requirement_sets.sql:5-7` | Mapped; DB pair unique absent metadata |
| `RequestComment` | `app/db/models.py:545-562` | `0020_request_comments.sql:5-18` | Mapped; request CASCADE |
| `PromotionRequestDocument` | `app/db/models.py:565-580` | `0019_requirement_sets.sql:9-29` | Mapped; DB pair unique absent metadata |
| `PromotionRequest` | `app/db/models.py:583-612` | `0010_new_core.sql:55-72`; `0013_dedup_promotion_requests.sql:1-6`; `0037_status_checks.sql:25-29` | Mapped; active-stage unique/status check |
| `VerificationDocument` | `app/db/models.py:615-630` | `0010_new_core.sql:75-88` | Mapped |
| `Notification` | `app/db/models.py:633-646` | `0010_new_core.sql:91-102` | Mapped; order-index gap DB-04 |
| `NotificationOutbox` | `app/db/models.py:648-665` | `0023_notification_outbox.sql:6-20` | Mapped; claim-index partial gap in matrix |
| `Technology` | `app/db/models.py:668-686` | `0007_organizations_technologies.py:26-35` | Mapped |
| `UserProfile` | `app/db/models.py:689-716` | `0016_profiles_organizations.sql:5-29` | Mapped; user unique |
| `UserOrganization` | `app/db/models.py:719-747` | `0016_profiles_organizations.sql:31-56` | Mapped; OGRN intentionally nonunique |
| `OrganizationMember` | `app/db/models.py:750-770` | `0016_profiles_organizations.sql:58-76` | Mapped; DB pair unique absent metadata |
| `NioktrCard` | `app/db/models.py:773-857` | wrappers `0014.py:26-34`, `0022.py:26-38`, `0027.py:26-33`, `0028.py:32-39,46-55`; `0031_perf_p14_created_date.sql:7-42` | Mapped; date conversion loss DB-07 |
| `NewsCategory` | `app/db/models.py:876-884` | `0024_news.py:40-52` | Mapped |
| `NewsTag` | `app/db/models.py:887-894` | `0024_news.py:40-52` | Mapped |
| `NewsPost` | `app/db/models.py:897-952` | `0024_news.py:40-52`; `0027_performance_indexes.py:26-33` | Mapped; feed index agrees |
| `NewsPostMedia` | `app/db/models.py:955-975` | `0024_news.py:40-52` | Mapped; sort-order race not DB-protected |
| `Achievement` | `app/db/models.py:981-1012` | `0025_achievements.py:40-48` | Mapped; seeded catalog |
| `UserAchievement` | `app/db/models.py:1015-1056` | `0026_achievement_awards.sql:11-31` | Mapped; NULL event_ref permits duplicates by design/service |
| `ProjectAchievement` | `app/db/models.py:1059-1087` | `0026_achievement_awards.sql:33-47` | Mapped; pair unique |
| `role_permissions_tbl` | `app/db/models.py:48-54` | `0003_rbac.sql:42-52` | Association mapped; composite PK |
| `user_roles_tbl` | `app/db/models.py:56-63` | `0003_rbac.sql:86-94` | Association mapped; composite PK |
| `news_post_tags_tbl` | `app/db/models.py:862-873` | `0024_news.py:40-52` | Association mapped; composite PK/CASCADE |

### Все Alembic revisions: lineage и downgrade verdict

`R` = structurally reversible; `D` = downgrade intentionally drops newly owned
data/schema; `L` = lossy/unsafe even relative to pre-upgrade state; citations point
to the executable wrapper downgrade.

| Revision <- parent | Downgrade citation | Verdict |
|---|---|---|
| `0001 <- base` | `0001_init_schemas.py:31-37` | D: drops log/test schema; deliberately retains public and vector extension |
| `0002 <- 0001` | `0002_rag_documents.py:31-36` | D: drops all RAG rows/table |
| `0003 <- 0002` | `0003_rbac.py:31-36` | D: drops RBAC/users and dependent data |
| `0004 <- 0003` | `0004_projects_and_questionnaire.py:34-40` | D: drops complete project aggregate/history |
| `0005 <- 0004` | `0005_rag_metadata.py:31-32` | D: drops metadata column/data |
| `0006 <- 0005` | `0006_join_tokens.py:31-36` | D: drops tokens/member state fields |
| `0007 <- 0006` | `0007_organizations_technologies.py:33-35` | D: drops registries |
| `0008 <- 0007` | `0008_audit_project_nullable.py:33-34` | L: SET NOT NULL fails while global audit rows exist |
| `0009 <- 0008` | `0009_control_point_decision_width.py:33-34` | L: narrowing to varchar(16) fails/loses compatibility for longer decisions |
| `0010 <- 0009` | `0010_new_core.py:33-41` | D: drops requests/docs/notifications/stages and columns |
| `0011 <- 0010` | `0011_readiness_assessment.py:33-37` | D: drops assessments/templates |
| `0012 <- 0011` | `0012_fix_gost_mojibake.py:33-35` | L: no-op; overwritten source values unrecoverable (DB-08) |
| `0013 <- 0012` | `0013_dedup_promotion_requests.py:33-34` | R: drops only owned partial unique index |
| `0014 <- 0013` | `0014_nioktr_cards.py:33-34` | D: drops NIOKTR data |
| `0015 <- 0014` | `0015_refresh_tokens.py:33-34` | D: drops refresh sessions |
| `0016 <- 0015` | `0016_profiles_organizations.py:33-36` | D: drops profiles/orgs/memberships |
| `0017 <- 0016` | `0017_project_invites_admin.py:33-41` | D: drops invites/legal/admin data |
| `0018 <- 0017` | `0018_file_storage.py:33-40` | D: drops all storage/scan metadata |
| `0019 <- 0018` | `0019_requirement_sets.py:33-35` | D: drops immutable request snapshots/template versions |
| `0020 <- 0019` | `0020_request_comments.py:33-34` | D: drops comments/history |
| `0021 <- 0020` | `0021_publication_consent.py:33-39` | D: drops publication consent/state |
| `0022 <- 0021` | `0022_nioktr_source.py:33-38` | D: drops source/provenance timestamps |
| `0023 <- 0022` | `0023_notification_outbox.py:33-34` | D: drops pending/delivery state |
| `0024 <- 0023` | `0024_news.py:47-52` | D: drops complete news module |
| `0025 <- 0024` | `0025_achievements.py:47-48` | D: drops seeded catalog (and CASCADE-sensitive dependents after 0026) |
| `0026 <- 0025` | `0026_achievement_awards.py:45-47` | D: drops award history |
| `0027 <- 0026` | `0027_performance_indexes.py:55-58` | R: restores absorbed news status index; Ruff B007 |
| `0028 <- 0027` | `0028_indexes_pagination.py:53-55` | R: drops only owned indexes; Ruff B007 |
| `0029 <- 0028` | `0029_rag_contour.py:44-48` | D: drops contour classification and partial indexes |
| `0030 <- 0029` | `0030_questionnaire_per_user.py:39-46` | L: drops ownership and old unique restore can fail on multi-user rows (DB-13) |
| `0031 <- 0030` | `0031_perf_p14_created_date.py:35-40` | L: type reverses, nulled raw values do not (DB-07) |
| `0032 <- 0031` | `0032_questionnaire_read_isolation.py:40-44` | L: drops indexes owned by 0030, leaving revision 0031 degraded (DB-13) |
| `0033 <- 0032` | `0033_revoke_self_registered_privileges.py:40-47` | L intentional security fix: role grants not restored |
| `0036_semantic <- 0033` | `0036_semantic_embeddings_reindex.py:41-49` | Partial R: comment/log revert; vectors were never migrated (DB-11) |
| `0037 <- 0036_semantic` | `0037_status_checks.py:38-54` | R: drops only four owned checks/log row |

All wrappers execute raw SQL and then insert `db_migration_log`; most downgrades
do not remove their log row. Because `filename` has only a nonunique hash index
(`0001_init_schemas.sql:32-46`), downgrade/re-upgrade leaves stale/duplicate audit
rows even when Alembic's own version is correct. This is bookkeeping corruption,
not a branch in the Alembic lineage.

## Coverage matrices

### Model-to-migration coverage

| Domain/models | Model source | Migration source | Coverage verdict |
|---|---|---|---|
| RBAC/users/tokens | `models.py:48-155` | `0003_rbac.sql:9-94`; `0015_refresh_tokens.py:26-34` | Covered; SQL has additional exact/range indexes |
| Project/team/questionnaire | `models.py:158-245,329-407` | `0004_projects_and_questionnaire.sql:2-83`; wrappers `0006.py:26-36`, `0017.py:26-41`, `0030.py:32-46`, `0032.py:32-44`, `0037.py:30-51` | Covered with DB-01/09/13; several DB uniques/checks absent metadata |
| Readiness/TRL | `models.py:248-326,531-542` | `0010_new_core.sql:6-34`; `0011_readiness_assessment.sql:4-70`; `0019_requirement_sets.sql:5-7` | Covered; DB TRL checks stronger than ORM; legacy TRL remains unchecked |
| Documents/requests/history | `models.py:410-461,545-630` | wrappers `0004.py:26-40`, `0008.py:26-34`, `0010.py:26-41`, `0013.py:26-34`, `0018.py:26-40`, `0019.py:26-35`, `0020.py:26-34`, `0037.py:30-51` | Covered with DB-02; audit/project CASCADE means history not immutable |
| RAG/vector | `models.py:464-498` | `0002_rag_documents.sql:6-39`; wrappers `0005.py:26-32`, `0029.py:37-48`, `0036.py:33-49` | Covered structurally; uniqueness/model-version gaps DB-06/11 |
| Registry/org/profile | `models.py:501-528,668-857` | wrappers `0007.py:26-35`, `0014.py:26-34`, `0016.py:26-36`, `0022.py:26-38`, `0027.py:26-33,48-58`, `0028.py:32-55`, `0031.py:28-40` | Covered; schema/test isolation DB-12 |
| Notifications/outbox | `models.py:633-665` | `0010_new_core.sql:91-102`; `0023_notification_outbox.sql:6-20` | Covered; predicate/order index gaps below |
| News | `models.py:862-975` | `0024_news.py:40-52`; `0027_performance_indexes.py:26-41,48-58` | Covered; relationship loading explicitly handled in public feed |
| Achievements | `models.py:981-1087` | `0025_achievements.py:40-48`; `0026_achievement_awards.sql:11-47` | Covered; nullable event dedup remains service-level |

### Predicate/order-to-index coverage

| Query shape | Call-site | Index/constraint citation | Verdict |
|---|---|---|---|
| email/role slug exact | `models.py:133-138` | `0003_rbac.sql:22-28,39-40,70-80` | Covered (unique B-Tree + project-required hash) |
| member projects by `user_id,status`; projects order updated/id | `projects.py:147-157,198-225` | `0027_performance_indexes.py:26-33`; `0004...sql:77-83` | Partial: user lookup covered; status and global order not composite (DB-04) |
| public projects `is_public`, level/updated/id keyset | `projects.py:243-280` | `models.py:208-215`; `0027_performance_indexes.py:26-33` | Partial: partial index omits tie-break `id`; optional budget/category combinations require filtering |
| NIOKTR date order + name/customer ILIKE + type JSONB + AI | `nioktr.py:163-189` | `models.py:826-857`; `0027...sql:18-23`; `0028...sql:8-29` | Covered individually; deep OFFSET and combined filters are not composite |
| organizations lateral card count/order | `nioktr.py:202-220` | `models.py:831`; `0027...sql:22-23` | Partial: correlated count lookup covered; count-desc requires aggregate/sort over candidates |
| organization OGRN exact + 20 cards date order | `nioktr.py:236-258` | `models.py:518-522,826-831` | Covered |
| news public status + published/id order | `news.py:203-229` | `models.py:947-952`; `0027...sql:26-32` | Covered; selectin avoids N+1 |
| notifications user + created/id order | `notifications.py:27-40` | `0010_new_core.sql:101-102` | Gap: `(user_id,is_read)` cannot satisfy order; unbounded (DB-04) |
| outbox scope/status + created/id order, lock next | `services/notifications.py:70-102` | `0023_notification_outbox.sql:19-20` | Partial: status/created covered; target_scope/id omitted; `SKIP LOCKED` concurrency safe |
| document max version by project/title | `files.py:55-62` | `0018_file_storage.sql:27-32` | Gap: index lacks title and uniqueness (DB-02) |
| questionnaire project/level/user | `projects.py:520-548,629-650` | `0030_questionnaire_per_user.sql:15-25` | Covered at head; downgrade ownership broken DB-13 |
| active promotion project/from/status | `stages.py:232-242,305-314` | `0013_dedup_promotion_requests.sql:1-6` | Covered by partial unique; concurrent insert fails safely but needs mapped conflict response |
| RAG KNN contour/type/level/order distance | `services/rag.py:27-45,182-194` | `0002_rag_documents.sql:28-39`; `0029_rag_contour.sql:28-36` | KNN covered globally/per contour; scalar filters post-filter; mixed-model DB-11 |
| RAG lexical `%term%` on title/raw_text | `services/rag.py:115-159` | no matching index in `0002:23-39`/`0028:8-29` | Gap: bounded return but full scan of text candidates |
| executor roles + completed project GROUP BY + name keyset | `executors.py:44-111` | `0003_rbac.sql:86-94`; `0027:29`; profile state `0016...sql:27-29` | Partial/heavy: no role_id-leading user_roles or `(full_name,id)` index; bounded by caller limit |
| achievement history date/group joins and stalled projects | `services/achievements.py:559-731` | hash FK indexes `0026_achievement_awards.sql:24-31,43-47`; projects indexes `models.py:208-215` | Gap/heavy: repeated full-history aggregates; no awarded_at or `(status,updated_at)` index |

## Query, transaction and lock verdicts

- Heavy JOIN verdict: **CONFIRMED, bounded** for executor registry: two subqueries,
  joins and GROUP BY (`executors.py:44-111`) with missing role/name-leading indexes;
  endpoint limit contains response size, not aggregate work. **CONFIRMED, bounded
  output but full candidate aggregation** for organization lateral count
  (`nioktr.py:202-220`). **CONFIRMED, unbounded aggregate work** for admin
  achievement stats: repeated full-history DISTINCT/date GROUP BY/catalog joins and
  stalled-project scan (`services/achievements.py:559-731`). Public news JOINs are
  bounded and selectin-loaded (`news.py:203-229`), so no N+1 finding there.
- Long transaction verdict: **CONFIRMED** in project file upload: access SELECT opens
  session transaction before body read, storage write and ClamAV scan, commit only at
  `files.py:78-109`; this holds a pool connection/transaction snapshot across external
  I/O. **CONFIRMED with locks** in stage trigger: promotion row is flushed at
  `stages.py:306-314`, then external `_evaluate` is awaited at `345`, commit at `379`.
  News publication fan-out materializes all active IDs and flushes every notification/
  outbox in one transaction (`services/notifications.py:105-154`): batching bounds ORM
  flush size, not transaction duration/WAL volume.
- Lock/deadlock verdict: **no deterministic application deadlock cycle confirmed**
  from static lock ordering. Invite claim is one conditional row UPDATE
  (`invites.py:157-212`); outbox uses `FOR UPDATE SKIP LOCKED`
  (`services/notifications.py:70-102`), both avoid check-then-act races. Confirmed
  lock risks are long-held stage row/index locks above and migration ACCESS EXCLUSIVE/
  table scans in DB-07/10. Concurrent promotion inserts serialize via partial UNIQUE;
  no explicit retry/error mapping was found. Dynamic deadlock proof remains blocked
  without disposable DB.

## Disposable DB harness verdict

- Repository harness exists but is **not safe/disposable for this audit**.
  `tests/conftest.py:11-14,23-45` hardcodes `technozrelost_test`, connects to the
  ambient `127.0.0.1:5432` cluster and creates a persistent database if absent;
  `tests/conftest.py:48-62` applies `alembic upgrade head`; `73-107` TRUNCATEs
  `public` after each test. It has no create-random/drop-finally lifecycle and no
  guard proving host/database ownership. Infra contains only regular/prod compose,
  not an isolated test compose (`infra/` directory inventory).
- Safe availability probes: `pg_isready -h 127.0.0.1 -p 5432 -d
  technozrelost_test` -> exact error `zsh:1: command not found: pg_isready`.
  No connection fallback was attempted because opening ambient PostgreSQL could
  touch the persistent test/demo cluster. `pytest`/Alembic were not invoked.
- Exact blocker: **BLOCKED: no repository-provided ephemeral PostgreSQL lifecycle
  with random database/container, ownership guard and guaranteed teardown; the only
  harness is state-changing against an ambient fixed database.** This is a safety
  blocker, not evidence that PostgreSQL itself is unavailable.

## Кандидаты находок

### DB-01: `questionnaire_results.user_id` одновременно NOT NULL и ON DELETE SET NULL

- Category: integrity / privacy lifecycle
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/app/db/models.py:218-245`;
  `technozrelost-backend/db/migrations/sql/0030_questionnaire_per_user.sql:5-25`;
  `technozrelost-backend/db/migrations/sql/0032_questionnaire_read_isolation.sql:8-20`
- Evidence: FK создан с `ON DELETE SET NULL`, затем колонка сделана `NOT NULL`;
  ORM сохраняет ту же несовместимую пару. PostgreSQL при удалении пользователя с
  анкетой пытается записать NULL и отклоняет весь DELETE.
- Safe reproduction: без БД сопоставить SQL 0030:7 с 0032:15. На disposable DB:
  создать user/project/questionnaire_result и удалить user; ожидать
  `NotNullViolation` вместо заявленного referential action.
- Impact: удаление/анонимизация ПДн блокируется зависимыми анкетами; retention
  procedure и будущий hard-delete не могут исполниться атомарно.
- Remediation: выбрать согласованную политику: nullable + SET NULL либо NOT NULL +
  RESTRICT/CASCADE; для ПДн определить явную анонимизацию владельца анкеты.
- Tests: migration contract на `pg_constraint`/`information_schema` и delete-user
  lifecycle test.
- Dependencies: privacy/retention policy.

### DB-02: параллельные загрузки получают одинаковую версию документа

- Category: concurrency / document integrity
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/app/api/v1/files.py:55-62,85-109`;
  `technozrelost-backend/app/db/models.py:410-446`;
  `technozrelost-backend/db/migrations/sql/0018_file_storage.sql:27-32`
- Evidence: версия вычисляется `max(version)+1` отдельным SELECT без row/advisory
  lock; индекс `(project_id, version)` не уникален и не включает `title`.
  Два запроса могут прочитать один max и оба успешно commit одинаковую версию.
  Кроме того, объект записывается во внешнее хранилище до DB commit, поэтому сбой
  commit оставляет orphan object.
- Safe reproduction: на disposable harness синхронизировать два upload после
  `_next_version`; обе строки получают N+1. Инъецировать ошибку commit после
  `store_project_file` и проверить лишний storage key.
- Impact: неоднозначный immutable history/snapshot документа; orphan-файлы
  расходуют storage и усложняют удаление ПДн.
- Remediation: UNIQUE `(project_id,title,version)` плюс retry/locked counter;
  компенсирующее удаление объекта при rollback либо transactional upload state.
- Tests: barrier-based concurrent upload и commit-failure cleanup test.
- Dependencies: storage lifecycle.

### DB-03: менеджерская очередь без pagination выполняет N+1 запрос анкет

- Category: query performance / reliability
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/app/api/v1/manager.py:69-80,99-112`;
  `technozrelost-backend/db/migrations/sql/0004_projects_and_questionnaire.sql:77-83`
- Evidence: endpoint загружает все draft-проекты, затем последовательно вызывает
  `_draft_row`, который выполняет отдельный SELECT questionnaire_results для
  каждого проекта. При N drafts получается N+1 round trips и unbounded response.
- Safe reproduction: статически N=1000 даёт 1001 SELECT; disposable query-counter
  должен показать линейный рост запросов.
- Impact: latency/pool occupancy растут линейно, один запрос менеджера способен
  удерживать worker и насыщать DB pool.
- Remediation: bounded keyset page и batch/selectin загрузка анкет.
- Tests: query-count invariant и максимальный размер страницы.
- Dependencies: API pagination contract.

### DB-04: несколько растущих лент читаются без верхней границы и без order-index

- Category: query performance / availability
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/app/api/v1/projects.py:147-157,198-225`;
  `technozrelost-backend/app/api/v1/notifications.py:27-40`;
  `technozrelost-backend/app/api/v1/news.py:239-260,264-307`;
  `technozrelost-backend/app/services/rag.py:215-224`;
  `technozrelost-backend/db/migrations/sql/0010_new_core.sql:101-102`
- Evidence: projects, notifications, own/admin news and RAG templates end in
  `.all()` without limit. Notifications order by `(created_at DESC,id DESC)`, but
  only `(user_id,is_read)` exists, forcing per-user sort; project listing also
  launches two IN-list aggregate fetches over the entire result.
- Safe reproduction: inspect call-sites above; disposable EXPLAIN with 100k rows
  shows response cardinality is data cardinality and notification sort is not
  covered by the existing index.
- Impact: memory, serialization, sort work and response time are unbounded.
- Remediation: keyset pagination; add predicate/order-matched indexes, notably
  notifications `(user_id,created_at DESC,id DESC)`.
- Tests: max-page contract and EXPLAIN-plan fixture at representative cardinality.
- Dependencies: frontend pagination.

### DB-05: RAG `top_k` не ограничен и напрямую масштабирует тяжёлый KNN/lexical путь

- Category: vector search / resource exhaustion
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/app/schemas.py:318-324`;
  `technozrelost-backend/app/api/v1/rag.py:36-42`;
  `technozrelost-backend/app/services/rag.py:27-45,124-159,182-211`
- Evidence: `top_k: int = 5` не имеет `ge/le`; сервис умножает его на 4 и передаёт
  в LIMIT, затем материализует и лексически оценивает raw_text каждой строки.
- Safe reproduction: authenticated POST `/rag/search` с `top_k=1000000`; схема
  принимает значение, а SQL limit становится 4,000,000. Отрицательное значение
  также принимается и даёт контринтуитивный slice результата вместо validation error.
- Impact: дорогой vector scan, перенос больших TEXT и CPU rerank доступны любому
  authenticated user; возможна деградация общего DB/worker pool.
- Remediation: `Field(ge=1, le=<bounded>)`, общий statement timeout/cost budget.
- Tests: HTTP boundary values and bounded generated LIMIT.
- Dependencies: capacity policy.

### DB-06: RAG upsert допускает дубликаты при конкуренции

- Category: uniqueness / RAG integrity
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/app/services/rag.py:49-98`;
  `technozrelost-backend/app/db/models.py:472-498`;
  `technozrelost-backend/db/migrations/sql/0002_rag_documents.sql:6-16,23-25`
- Evidence: дедупликация заявлена по `(content_hash,doc_type,contour)`, но реализована
  check-then-insert. DB имеет лишь неуникальный hash index по `content_hash`; ORM
  UniqueConstraint отсутствует. Две транзакции обе вставят строку. Первый commit
  происходит до расчёта embedding, поэтому ошибка второго этапа оставляет
  частично созданный документ без вектора.
- Safe reproduction: два concurrent `POST /rag/templates` с одинаковыми text/type/
  contour дают две строки; monkeypatch `embed_text` после первого commit оставляет
  `embedding IS NULL`.
- Impact: duplicate retrieval, расход vector index/storage и неполные документы.
- Remediation: unique B-tree на три поля и single-transaction upsert/embedding,
  либо явное persisted processing state with retry.
- Tests: concurrent upsert and embedding-failure atomicity.
- Dependencies: none.

### DB-07: миграция 0031 безвозвратно заменяет исходные даты на NULL и долго блокирует таблицу

- Category: migration data loss / locks
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/db/migrations/sql/0031_perf_p14_created_date.sql:7-35,40-42`;
  `technozrelost-backend/alembic/versions/0031_perf_p14_created_date.py:28-40`;
  `technozrelost-backend/tests/test_migration_remediation.py:32-105`
- Evidence: все не-ISO и календарно невалидные значения UPDATE-ятся в NULL без
  quarantine/archive; downgrade восстанавливает тип, но не значения. PL/pgSQL
  проходит подходящие строки по одной, затем `ALTER COLUMN TYPE` переписывает и
  ACCESS EXCLUSIVE-locks таблицу; индекс удаляется/строится не CONCURRENTLY.
- Safe reproduction: сам существующий тест 13-105 ожидает потерю пяти значений;
  не запускался, поскольку меняет БД. На snapshot сравнить non-null count/raw
  values до и после и измерить lock wait.
- Impact: потеря provenance импортированных НИОКТР-дат; на большой таблице deploy
  блокирует reads/writes и может превысить окно обслуживания.
- Remediation: quarantine original value, set-based validated conversion, staged
  nullable column/backfill, concurrent index and explicit lock/timeout plan.
- Tests: preservation/quarantine assertions and production-volume lock rehearsal.
- Dependencies: migration runbook and backup.

### DB-08: data-fixing миграция 0012 имеет пустой downgrade

- Category: migration reversibility
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/db/migrations/sql/0012_fix_gost_mojibake.sql:10-32`;
  `technozrelost-backend/alembic/versions/0012_fix_gost_mojibake.py:26-35`
- Evidence: upgrade перезаписывает `title/source_uri` для сотен строк; downgrade
  равен `pass`, исходные значения нигде не сохраняются.
- Safe reproduction: логически полный diff: любое совпавшее значение до upgrade
  невозможно вывести из преобразованной строки при downgrade.
- Impact: rollback приложения не возвращает прежний data contract; forensic origin
  теряется.
- Remediation: backup mapping/audit table либо явно forward-only migration с
  preflight backup and rollback procedure.
- Tests: round-trip fixture or documented irreversible-migration gate.
- Dependencies: backup policy.

### DB-09: 0032 может остановить upgrade на легальных legacy-проектах без created_by

- Category: migration backward compatibility
- Proposed severity: High
- Confidence: Probable
- Files: `technozrelost-backend/app/db/models.py:188-190`;
  `technozrelost-backend/db/migrations/sql/0004_projects_and_questionnaire.sql:2-12`;
  `technozrelost-backend/db/migrations/sql/0030_questionnaire_per_user.sql:9-13`;
  `technozrelost-backend/db/migrations/sql/0032_questionnaire_read_isolation.sql:8-15`
- Evidence: `projects.created_by` всегда nullable. Оба backfill копируют этот NULL,
  затем 0032 без preflight делает `user_id SET NOT NULL`. Для анкеты проекта без
  создателя NULL остаётся и DDL падает.
- Safe reproduction: disposable state на revision 0031: project(created_by=NULL)
  + questionnaire_result(user_id=NULL), затем upgrade 0032 -> NotNullViolation.
- Impact: deployment/migration полностью откатывается и блокирует релиз на
  допустимых по старой схеме данных.
- Remediation: preflight/count, deterministic sentinel/owner policy, затем assert
  zero NULL before constraint.
- Tests: upgrade fixture с nullable legacy owner.
- Dependencies: orphan ownership policy.

### DB-10: 0037 валидирует большие таблицы под блокировкой без preflight/NOT VALID

- Category: migration reliability / locks
- Proposed severity: Medium
- Confidence: Probable
- Files: `technozrelost-backend/db/migrations/sql/0037_status_checks.sql:12-37`;
  `technozrelost-backend/alembic/versions/0037_status_checks.py:30-35`
- Evidence: четыре `ADD CONSTRAINT CHECK` исполняются подряд, сразу сканируют
  существующие таблицы и требуют lock; неизвестный legacy status валит весь head.
  Миграция не делает diagnostic preflight, cleanup или `NOT VALID` + later validate.
- Safe reproduction: на disposable revision 0036 вставить разрешённый старой
  схемой status `unknown`, upgrade head; ожидать CheckViolation. На объёмной копии
  наблюдать lock/scans.
- Impact: surprise deploy failure либо длительная блокировка hot project/document
  writes.
- Remediation: preflight invalid values, explicit mapping, add NOT VALID then
  `VALIDATE CONSTRAINT` in controlled phase with lock timeout.
- Tests: legacy-status upgrade and lock-budget rehearsal.
- Dependencies: production status inventory unavailable.

### DB-11: Alembic head помечает semantic-v2, но не переиндексирует сохранённые векторы

- Category: vector data compatibility
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/alembic/versions/0036_semantic_embeddings_reindex.py:7-12,33-49`;
  `technozrelost-backend/db/migrations/sql/0036_semantic_embeddings_reindex.sql:1-19`;
  `technozrelost-backend/app/services/rag.py:167-211`
- Evidence: revision только меняет COMMENT и гарантирует старые named indexes;
  пересчёт вынесен в ручной script. Repo-wide call-site search не нашёл вызова
  `scripts/reindex_rag_embeddings.py` из migration/deploy/CI. После `alembic upgrade
  head` старые vectors остаются от прежней модели, но новые пишутся semantic-v2 и
  KNN сравнивает их в одном пространстве.
- Safe reproduction: snapshot embedding старой строки, выполнить только upgrade
  0036 и сравнить bytes: не изменятся; добавить новый документ и сравнить mixed
  retrieval. Постоянная БД не использовалась.
- Impact: недостоверный ranking/RAG после штатного deploy, несмотря на metadata,
  пока оператор отдельно не запустит неатомарный reindex.
- Remediation: версионировать embedding model в строке, dual-index/backfill and
  cutover; автоматизировать resumable reindex и readiness gate.
- Tests: old/new model migration fixture and post-head model-version invariant.
- Dependencies: deployment orchestration.

### DB-12: настройки test schema объявлены, но ORM/Alembic их не используют

- Category: schema isolation / test safety
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/app/core/config.py:33-34`;
  `technozrelost-backend/app/db/models.py:35-67`;
  `technozrelost-backend/alembic/env.py:28-48`;
  `technozrelost-backend/tests/conftest.py:48-62,73-107`
- Evidence: `db_schema_public/db_schema_test` нигде не используются кроме
  объявления; metadata и все SQL жёстко адресуют `public`. Test fixture мигрирует
  и TRUNCATE-ит `public`; schema_translate_map отсутствует. Изоляция достигается
  только отдельным именем DB, не обязательными раздельными schemas.
- Safe reproduction: repo-wide поиск имён настроек даёт только config declaration;
  inspection metadata.schema возвращает `public` при любом APP_ENV.
- Impact: заявленный schema safety guard отсутствует; ошибочный test DSN способен
  применить migrations/TRUNCATE к `public` выбранной БД.
- Remediation: fail-closed test DSN/database guard и реальное schema mapping/test
  schema; квалифицировать все cleanup names согласованно.
- Tests: test-env metadata/search_path assertion and refusal on non-test DB.
- Dependencies: database isolation decision.

### DB-13: questionnaire downgrade не восстанавливает revision 0029/0031 безопасно

- Category: migration downgrade / data loss
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/alembic/versions/0030_questionnaire_per_user.py:39-46`;
  `technozrelost-backend/alembic/versions/0032_questionnaire_read_isolation.py:40-44`;
  `technozrelost-backend/db/migrations/sql/0030_questionnaire_per_user.sql:15-25`
- Evidence: downgrade 0032 удаляет оба индекса, созданные и принадлежащие 0030,
  поэтому состояние revision 0031 уже не соответствует upgrade 0030. Следующий
  downgrade 0030 сначала удаляет `user_id`, затем восстанавливает UNIQUE
  `(project_id,level_id)`; если два пользователя ответили на один уровень, удаление
  ownership превращает строки в дубликаты и ADD CONSTRAINT падает.
- Safe reproduction: disposable head DB: два questionnaire rows одного project/
  level с разными user; downgrade 0029. Ожидать UniqueViolation в 0030 downgrade;
  отдельно downgrade 0031 и проверить отсутствие обоих 0030 indexes.
- Impact: штатный rollback может остановиться посередине и не способен сохранить
  per-user данные; revision state между 0030/0032 имеет schema drift.
- Remediation: 0032 не должен удалять 0030-owned indexes; 0030 downgrade требует
  explicit lossy merge/archive policy либо должен быть declared non-reversible.
- Tests: exact-schema assertions at every downgrade target and multi-user round trip.
- Dependencies: questionnaire rollback policy.

### DB-14: внешняя оценка ожидается внутри транзакции после flush заявки

- Category: long transaction / lock contention
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/app/api/v1/stages.py:212-242,305-379`;
  `technozrelost-backend/app/api/v1/files.py:78-109`;
  `technozrelost-backend/app/services/notifications.py:105-154`
- Evidence: stage flow читает aggregate, INSERT/flush-ит PromotionRequest, затем
  ожидает `_evaluate` до commit. Row/index locks и connection удерживаются на время
  внешней оценки. File flow открывает transaction SELECT-ом до чтения/upload/scan.
  News fan-out держит одну транзакцию на всех активных пользователей, несмотря на
  flush batches.
- Safe reproduction: disposable harness с `_evaluate`/scanner barrier и второй
  competing UPDATE; наблюдать open transaction/blocked writer до release. Для fan-out
  query counter/transaction timer растёт с числом users.
- Impact: LLM/ClamAV latency занимает DB pool, увеличивает lock waits и при burst
  создаёт pool exhaustion; fan-out создаёт большой WAL/rollback domain.
- Remediation: завершать DB read transaction до external I/O; persist short-lived
  pending job/outbox, evaluate asynchronously, затем conditional short transaction.
- Tests: transaction-duration/competing-writer test and bounded fan-out worker batches.
- Dependencies: async job/outbox design.

## Проверенные области без отдельной находки

- PK используют BigSerial/Identity; FK/cascade и основные unique проверены по всей
  модели и SQL. DB constraints, отсутствующие в ORM metadata (например
  `uq_project_user`, assessment uniqueness, promotion snapshots), фактически
  создаются миграциями; runtime не использует `create_all`.
- Project/member, assessment answer, invite token, active promotion request,
  organization membership и achievement dedup имеют DB uniqueness. Invite slot
  claim атомарен (`app/api/v1/invites.py:157-212`); outbox claim использует
  `FOR UPDATE SKIP LOCKED` (`app/services/notifications.py:70-102`). Явного
  optimistic version column в изменяемых агрегатах нет; DB-02 является
  подтверждённым последствием, остальные lost-update сценарии требуют dynamic test.
- Soft-delete как общий механизм отсутствует; проекты архивируются status, users
  деактивируются. Audit trail существует, но каскадно удаляется вместе с проектом
  (`app/db/models.py:449-460`), поэтому это operational log, не immutable history.
- FTS (`tsvector/tsquery`) отсутствует. Lexical fallback использует bounded ILIKE
  over `title/raw_text` (`app/services/rag.py:115-160`), при этом trgm indexes для
  этих RAG полей отсутствуют; текущий candidate limit ограничивает результат, но
  не scan cost. Vector dimension 1536 согласован model/migration; contour filters
  совпадают с partial ivfflat predicates, кроме поиска `contour=None`, которому
  остаётся общий ivfflat index из 0002.
- Уровни TRL частично защищены CHECK в readiness-таблицах, но legacy
  projects/questionnaire/technologies полагаются на API validation. Это defense in
  depth gap, однако прямой публичный путь записи некорректного уровня в просмотренных
  call-sites не подтверждён, поэтому отдельная находка не создана.
- Production EXPLAIN, cardinality, lock timing, orphan/duplicate counts и RPS/p95
  BLOCKED: production/test DB и безопасный disposable migration harness не были
  доступны в рамках read-only контракта; расчётные риски не выданы за измерения.

## Глубинные состояния

- Чистая БД: линейный upgrade логически покрыт; extensions требуют привилегий, live
  proof не выполнялся. Пустые данные: DDL согласован, кроме внешнего reindex DB-11.
- Legacy/invalid: DB-07, DB-09, DB-10. Interrupt/retry: Alembic transactional DDL
  снижает partial-schema риск; external storage DB-02 и two-commit RAG DB-06 нет.
- Рост: DB-03/04/05 и lock paths DB-07/10. Role/org boundary: query authorization
  отдельно не переоценивалась; DB-12 покрывает test isolation. Consequence/
  reversibility: DB-07/08/11. Dependency failure: DB-02/06; replica/read-after-write
  не оценивалась как finding без runtime lag evidence.
