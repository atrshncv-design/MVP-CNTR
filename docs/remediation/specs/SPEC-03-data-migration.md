# SPEC-03: Корректность данных анкеты и миграций (M-01, M-02)

## Контекст
M-02: после per-user изоляции `N-16` (`questionnaire_results.user_id` nullable, UNIQUE `(project_id,level_id,user_id)` `0030_questionnaire_per_user.sql:1`) чтение `GET /projects/{id}` (`projects.py:508`) отдаёт все строки проекта любому участнику → leak чужих `percentage` и дубли уровней. M-01: `0031_perf_p14_created_date.sql:5` `USING NULLIF(TRIM(created_date),'')::date` падает на `created_date='not-a-date'` → `alembic upgrade head` rollback, деплой с `backend-entrypoint.sh` advisory lock не проходит. Затронуты `app/db/models.py:208`, `app/api/v1/projects.py:508,562`, `alembic/versions/0030..0031`, `db/migrations/sql/0031_perf_p14_created_date.sql`.

## Цель
Миграция 0031 идемпотентна на грязных данных; чтение анкеты изолировано — обычные роли видят только своё, staff видит агрегат.

## Не входит
Изменение `target_level` логики, `P-15` batch уже done. Не менять `is_ai_area` индексы (уже 0028).

## Функциональные требования
- `FR-01` `alembic upgrade head` на БД где `nioktr_cards.created_date` содержит `''`, `'2024-02-30'`, `'неизвестно'`, `'2024-13-01'` → не падает, такие строки становятся `NULL`, валидные `YYYY-MM-DD` → `DATE`.
- `FR-02` `POST /projects/{id}/questionnaire` per-user: `user A` `level 1 90%` + `user B` `level 1 30%` → в БД две строки `(project,1,A)` и `(project,1,B)`, `B` не перезаписывает `A`.
- `FR-03` `GET /projects/{id}`: `user A` видит в `questionnaire_results` только свою строку `(A)`, `cntr_admin` видит `avg` по проекту или все с `user_id` (выбрано в Q-02: A для member, B для staff → `GET` для staff отдаёт `mean percentage`).
- `FR-04` `QuestionnaireResult.user_id` после backfill `NOT NULL` (или `partial index` где `user_id IS NOT NULL`), старые `NULL` → `projects.created_by`.
- `FR-05` Rollback `alembic downgrade 0031` → `VARCHAR(32)` без потери валидных дат (`::text`).

## Нефункциональные
- Производительность: `GET /projects/{id}` N=10k проектов с 5 анкетами каждый — `select ... where user_id=?` использует `ix_questionnaire_results_project_level_user`.
- Совместимость: старые `questionnaire_results` без `user_id` после 0030 backfill → не ломают `GET`.

## Техническое решение
- `0031_perf_p14_created_date.sql:5` заменить `USING NULLIF(TRIM(created_date),'')::date` на `USING CASE WHEN TRIM(created_date) ~ '^\d{4}-\d{2}-\d{2}$' AND TRIM(created_date)::date IS NOT NULL THEN TRIM(created_date)::date ELSE NULL END` — но `~` + `::date` в `CASE` всё равно бросает на `2024-02-30`. Надёжнее: pre-migration `UPDATE nioktr_cards SET created_date=NULL WHERE TRIM(created_date) !~ '^\d{4}-\d{2}-\d{2}$' OR created_date::date IS NULL` с `BEGIN; EXCEPTION WHEN invalid_datetime_format THEN NULL` — или `USING NULLIF(TRIM(created_date),'')::date` с `TRY_CAST` через `to_date` + `WHEN ... THEN ...`. Простейший idempotent: `UPDATE public.nioktr_cards SET created_date = NULL WHERE created_date IS NOT NULL AND created_date !~ '^\d{4}-\d{2}-\d{2}$';` затем `ALTER ... USING created_date::date` где уже только ISO или NULL. Или использовать `pg::try_cast`.
- Альтернатива: `USING (CASE WHEN created_date ~ '^\d{4}-\d{2}-\d{2}$' THEN created_date::date ELSE NULL END)` + `WHERE created_date ~ ...` pre-clean — выбрать этот, задокументировать в `0032`.
- `0032_questionnaire_read_isolation.py` (новая миграция 0032): `ALTER TABLE questionnaire_results ALTER COLUMN user_id SET NOT NULL` после `UPDATE ... SET user_id=projects.created_by WHERE user_id IS NULL`, `DROP CONSTRAINT uq_project_level_user` → `ADD CONSTRAINT uq_project_level_user UNIQUE (project_id,level_id,user_id)` уже есть, просто `SET NOT NULL`.
- `projects.py:508` — `qr_stmt = select(QuestionnaireResult).where(project_id==...).where(user_id==current.id)` для не-staff, для `is_cntr_staff` → `select avg(percentage) group by level_id` или `select *` с `user_id` в out. Выбрать: member-only, staff → all с `user_id` (прозрачно). Обновить `ProjectDetailOut.questionnaire_results` → остаётся `list[QuestionnaireResultOut]` но staff видит N строк.
- `models.py:218` `user_id` → `Mapped[int]` `nullable=False` после миграции, validator `_coerce_created_date` уже есть для `NioktrCard`.

## Сценарии
- **Given** `nioktr_cards` с `created_date='bad'`, **When** `alembic upgrade head`, **Then** `bad` → `NULL`, upgrade success.
- **Given** проект с `A: lvl1 90%`, **When** `B POST questionnaire lvl1 30%`, **Then** `A GET` видит 90%, `B GET` 30%, `admin GET` видит 2 строки.
- **Given** `GET /projects/{id}` без `user_id` фильтра (до фикса), **When** `A GET`, **Then** FAIL — теперь PASS.
- **Given** `alembic downgrade 0031`, **When** downgrade, **Then** `created_date` `DATE '2024-01-02'` → `'2024-01-02'` text, не потеря.

## Безопасность
- `percentage` — не ПДн, но командный грейд — скрыть от outsider; `require_project_access` уже 404 для non-member.

## Тестирование
- Migration: `test_migration_0031_handles_garbage_date` — создать temp БД, `INSERT nioktr_cards created_date='bad'`, `alembic upgrade` не бросает.
- Integration: `test_questionnaire_per_user_read_isolation` — A/B/admin GET как выше.
- Unit: `test_coerce_created_date` уже в `models.py`.

## Критерии приёмки
- [ ] `0031` SQL с `CASE`/`UPDATE` pre-clean, `alembic upgrade/downgrade` idempotent на грязной БД.
- [ ] `GET /projects/{id}` member видит только своё, admin — все.
- [ ] `user_id` `NOT NULL` после 0032 (grep `SET NOT NULL`).
- [ ] `ruff/mypy/pytest` green.

## DoD
FR, миграции обратимы, `projects.py` read isolation, тесты, `PROGRESS.md` обновлён, нет TODO.
