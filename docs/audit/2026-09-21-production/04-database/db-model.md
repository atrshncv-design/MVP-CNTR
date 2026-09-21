# 04 — Статическая модель БД (ORM + migrations, local `f364388`)

Источник: `technozrelost-backend/app/db/models.py` (1087 строк),
`alembic/versions/` (35 файлов), `app/core/database.py`, `app/core/security.py`.
Production-утверждения — только EV-011; остальное static/local.

## Entities (39 объектов `Base.metadata`, схема `public`, `MetaData(schema="public")`)

36 declarative-классов с `__tablename__` + 3 Core association `Table`
(`role_permissions`, `user_roles`, `news_post_tags` — `models.py:48-63,862`)
= 39 объектов `Base.metadata` (проверено `Base.metadata.tables`, EV-009).
Ниже перечислены 39 имён таблиц:

`achievements`, `assessment_answers`, `assessment_checkpoints`,
`assessment_templates`, `audit_trail`, `control_points`, `news_categories`,
`news_post_media`, `news_post_tags`, `news_posts`, `news_tags`, `nioktr_cards`,
`notification_outbox`, `notifications`, `organization_members`, `organizations`,
`permissions`, `project_achievements`, `project_assessments`,
`project_documents`, `project_invites`, `project_members`, `projects`,
`promotion_request_documents`, `promotion_requests`, `questionnaire_results`,
`rag_documents`, `refresh_tokens`, `request_comments`, `role_permissions`,
`roles`, `stage_requirements`, `technologies`, `user_achievements`,
`user_organizations`, `user_profiles`, `user_roles`, `users`,
`verification_documents`.

Связи RBAC — через ассоциативные таблицы `role_permissions`, `user_roles`
(composite PK, `server_default=func.now()`).

## Constraints (EV-009)

- PK: 39/39 таблиц (`Integer/BigInteger + Identity(always=True)` — AGENTS-контракт Serial).
- FK: 55 (пример: `audit_trail.project_id → projects.id ON DELETE CASCADE`).
- Unique: 17 (пример: `users.email`, `roles.slug`, `organizations` ogrn — см. ниже).
- Check: 5. NOT NULL колонок: 218.
- Soft delete: колонок `is_deleted`/`deleted_at` — 0 во всём репозитории
  (удаления жёсткие; аудит — только `audit_trail`: `project_id`, `user_id`,
  `action`, `details JSONB`, `created_at`).
- Timestamps: `created_at` повсеместно (`server_default=func.now()`, TZ-aware);
  `updated_at` — на ключевых сущностях (`users`, `projects`, ...), не на всех.

## Indexes (17 ORM + migration-managed)

ORM (`models.py`): Hash для exact — `ix_organizations_ogrn_hash(ogrn)`,
`ix_user_achievements_{user,project,achievement}_id_hash`,
`ix_project_achievements_{project,achievement}_id_hash` (AGENTS-контракт Hash);
B-Tree default — `ix_nioktr_cards_is_ai_area_btree`,
`ix_projects_category`, `ix_project_members_user_id`,
`ix_nioktr_cards_organization_id`, `ix_nioktr_cards_created_date`,
`ix_news_posts_status_published`; GIN trigram — `nioktr_cards.name`,
`nioktr_cards.customer_name`, `organizations.name`; GIN array —
`nioktr_cards.nioktr_types`; partial — `ix_projects_public_registry
(current_level, updated_at) WHERE is_public`.

Migration-managed (вне ORM-metadata, осознанно): два частичных ivfflat
`rag_documents_embedding_{tuno,kaba}_ivfflat WHERE contour = ...`
(`0029_rag_contour.py`, гарантия `IF NOT EXISTS` в `0036`), перф-индексы
`0027/0028/0031`. Следствие → DB-03: metadata-инструменты их не видят.

Векторная колонка: 1 — `rag_documents.embedding`, dim 1536
(`VECTOR_DIMENSION=1536` в `.env.example` — имя+default примера, не prod-value).

## Migrations chain (EV-010/EV-011/EV-013)

Линейная: `0001 → 0002 → ... → 0031 → 0032 → 0033 → 0036_semantic → 0037`
(head `0037_status_checks.py`). Файлов 35; `0034/0035` не существовало.
Сравнение локального и серверного наборов — только parity 35 имён файлов
 (EV-011, 35/35); содержимое/checksum файлов не сравнивались. Applied drift
 production catalog evidence не закрыт: доказан только паритет применённой
 версии в prod-БД — `0037` (EV-013, `public.alembic_version`) с файловым head;
 schema/content/manual drift — UNKNOWN (definitions/checksums не сравнивались).
Downgrade есть (проверен `0036`: `def downgrade`, возвращает
комментарий+журнал). Схемы: `public` + `test` (`0001_init_schemas.py`;
`DB_SCHEMA_PUBLIC/TEST` — имена ключей).

## Доступ к данным (static) и R14 (роли + владение + приглашения)

- `database.py`: `engine` (Primary, `get_db` — запись), `read_engine`
  (Replica, `get_read_db` — только чтения, fallback на Primary);
  пул из настроек (`pool_size`/`max_overflow` — имена), `NullPool` в тестах.
- Роли (static, EV-014): модели `Role`/`Permission` (`models.py:73-107`),
  Core-таблицы `role_permissions_tbl`/`user_roles_tbl` (`models.py:48-63`),
  enforcement `require_role`/`has_role` (`deps.py:128-145`,
  `user_slugs & allowed or is_superuser`), `CNTR_STAFF_SLUGS`
  (`deps.py:148`), allowlist саморегистрации + отзыв миграцией 0033.
  Prod-агрегат: `roles` 9 строк, `permissions` 17, `role_permissions` 38
  (EV-013, только counts). Runtime-назначение ролей — UNKNOWN (R36).
- Владение проектом (static, EV-014): `Project.created_by → users.id`
  (`models.py:189`), `ProjectMember` (`models.py:329-351`: `project_id`,
  `user_id`, `role_in_project`, `status`, `invited_by`, `is_project_admin`),
  query construction `can_access_project`/`require_project_access`
  (`projects.py:180-206`: superuser/staff/создатель/активный участник,
  нарушителю — 404-маскировка), админские ветви через
  `ProjectMember.is_project_admin.is_(True)` (`projects.py:394`,
  `invites.py:82`). Runtime-поведение авторизованных сценариев — UNKNOWN.
- Приглашения (static, EV-014): `ProjectInvite` (`models.py:354-380`:
  `project_id`, `created_by`, `token` unique, `allowed_roles` JSONB,
  `max_uses`/`used_count`, `expires_at`/`revoked_at`),
  `require_project_admin` + endpoints (`invites.py:58-96,225-256`),
  join-токены `generate_join_token` на `secrets`-алфавите
  (`models.py:37-46`). Использование/истечение в runtime — UNKNOWN.
- Tenant isolation: только application-level (RBAC/ownership/invites);
  `tenant_id`/RLS-политики отсутствуют (EV-012) → DB-02.
- Секреты кода: пароли — bcrypt (`security.py:14`); refresh/invite-токены —
  SHA-256 хеш (`security.py:53`), join-токены — `secrets`-алфавит
  (`models.py:38-46`). JWT HS256, refresh — атомарный `UPDATE ... WHERE
  revoked_at IS NULL` (контур security-тикета, здесь только факт хранения
  в `refresh_tokens`).

## Production-каталог (EV-013, read-only внутри `tz-prod-db-primary`)

Аутентификация — только passthrough существующего окружения контейнера
(`PGPASSWORD="$POSTGRES_PASSWORD"`, значения нигде не выводились);
все запросы — одиночные SELECT, business rows не читались.

- `public.alembic_version` = `0037` (одна строка) — доказан только паритет
   применённой версии с файловым head (35 имён, EV-011);
   schema/content/manual drift — UNKNOWN (definitions/checksums не сравнивались).
- `public` BASE TABLEs: 41 = 39 объектов ORM-metadata + `alembic_version`
  + `db_migration_log`.
- Constraints prod-каталога: PK 41, FK 55, unique 12, check 8. FK 55/55
   совпадает со static (EV-009); check 8 против static 5 и unique 12 против
   static 17 — наблюдаемое расхождение подсчёта (миграционные checks,
   partial/unique-индексы вне ORM-declarations); без полного поимённого
   reconciliation вывод «не drift» не делается, schema drift — UNKNOWN.
- `pg_indexes` схемы `public`: 150 строк (ORM 17 из EV-009 — подмножество;
  остальное — миграционные, вкл. ivfflat `0029/0036`, перф-индексы
  `0027/0028/0031`).
- Роли (только имена): дефолтные `pg_*` + `replicator` + `technoz`
  (16 строк). Grants: только `technoz` — полный набор (7 привилегий ×
  41 таблица); отдельной read-only роли нет.
- Размеры: `pg_database_size` — 33 MB (du PG-данных 136M в EV-011 включает
  WAL/служебное); крупнейшая `rag_documents` — 21 MB.
- Aggregate counts (EV-013, `count(*)` по каждой таблице, без строк):
  `rag_documents` 677, `achievements` 66, `role_permissions` 38,
  `db_migration_log` 35, `refresh_tokens` 24, `assessment_answers` 22,
  `assessment_checkpoints` 22, `permissions` 17, `questionnaire_results` 9,
  `roles` 9, `stage_requirements` 8, `news_categories` 5, `audit_trail` 2,
  `notification_outbox`/`notifications`/`user_achievements` по 2,
  `assessment_templates`/`project_achievements`/`project_assessments`/
  `project_members`/`projects`/`user_profiles`/`user_roles`/`users` по 1,
  остальные (`control_points`, `news_*`, `nioktr_cards`,
  `organization_members`, `organizations`, `project_documents`,
  `project_invites`, `promotion_*`, `request_comments`, `technologies`,
  `verification_documents`) — 0.

## Injection surface (EV-012, без destructive payloads по запрету)

- Запросы — SQLAlchemy ORM (`select`/`mapped_column`/`where`); f-string SQL
  с DML — 0; `.format()`-SQL — 0.
- `text()` — 4 статических литерала без пользовательского ввода:
  `pg_try_advisory_lock(42)` / unlock (`main.py:78-86`),
  `stmt.where(text("1=0"))` как fail-closed ветвь (`executors.py`),
  `postgresql_where=text("is_public")` (partial index).
- Параметризация сидов: `db.execute(text(sql), {"emb":..., "did":...})`
  (`seed_gost.py:173`) — bound parameters, не интерполяция.
- Таргет-прогон гейтов: `cd technozrelost-backend && uv run pytest
  tests/test_migration_remediation.py -q` → setup ERROR
  (`psycopg.OperationalError: connection refused 127.0.0.1:5432` — нет
  локальной test DB), итог `1 warning, 1 error`; статус BLOCKED (EV-015).
  Зелёных прогонов этих гейтов в тикете нет.
