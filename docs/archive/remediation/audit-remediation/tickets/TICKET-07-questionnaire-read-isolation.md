# TICKET-07: Изоляция чтения анкеты (M-02)

- **Спека:** SPEC-03
- **Проблемы:** M-02 (read leak чужих `percentage`)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** M
- **Зависимости:** TICKET-06 (миграция 0031 clean)
- **Можно параллельно с:** TICKET-08,09,11

## Проблема
После `0030 per-user` запись per-user, но `GET /projects/{id}` `projects.py:508` `select(QuestionnaireResult).where(project_id==...)` без `user_id` → любой участник видит все строки проекта (A видит B 30%).

## Требуемый результат
- `GET /projects/{id}` (и `GET /projects` list) — `member` sees only `where user_id==current`, `cntr_admin/manager` sees all + `avg`.
- `0032` миграция `user_id NOT NULL` после backfill.

## Объём работ
- `app/api/v1/projects.py:508` `get_project_detail` — `qr_stmt = select(QuestionnaireResult).where(project_id==...).where(QuestionnaireResult.user_id==user.id)` если не `is_cntr_staff(user)`, иначе без фильтра (или `avg`).
- `projects.py:184` `list_projects` — не трогать (не отдаёт анкету), но `get_project_detail` аналогично для `questionnaire_results`.
- `alembic/versions/0032_questionnaire_read_isolation.py` + `db/migrations/sql/0032_*.sql` — `UPDATE questionnaire_results SET user_id=projects.created_by WHERE user_id IS NULL` (уже в 0030, но повторно) → `ALTER COLUMN user_id SET NOT NULL` → `CREATE INDEX IF NOT EXISTS ix_questionnaire_results_user_id`.
- `app/db/models.py:223` `user_id: Mapped[int]` `nullable=False` (после миграции).

## Не входит
Изменение `target_level` логики, `P-15` batch.

## Компоненты
- Файлы: `app/api/v1/projects.py`, `app/db/models.py`, `alembic/versions/0032*`, `db/migrations/sql/0032*`

## План
1. `read projects.py:490..510`.
2. Добавить `if not is_cntr_staff(user): stmt = stmt.where(user_id==current)`.
3. Миграция 0032 `SET NOT NULL`.
4. `models.py` `nullable=False`.
5. `ruff/mypy`.

## Пограничные случаи
- `cntr_admin` создаёт проект — видит все.
- Старые `NULL` после 0030 — backfill в 0032.
- `GET` без `questionnaire_results` — пустой list.

## Тесты
- `test_questionnaire_per_user_read_isolation` — A 90%, B 30%, `A GET` 90% only, `admin` 2 rows.
- `test_performance_indexes` — `ix_questionnaire_results_user_id` exists.

## Критерии приёмки
- [ ] `A GET` не видит `B` %, `admin` видит оба.
- [ ] `user_id NOT NULL` в `psql \d questionnaire_results`.
- [ ] `pytest -k test_questionnaire` PASS.

## Команды проверки
- `.venv/bin/pytest tests/test_rbac_projects.py tests/test_questionnaire_isolation.py -q`
- `.venv/bin/mypy app`

## Риски
- `SET NOT NULL` без backfill → fail — backfill first.
- Фронт ожидает один `percentage` per level — теперь 2, staff-агрегат должен `avg`, иначе UI дубли — документировать.
