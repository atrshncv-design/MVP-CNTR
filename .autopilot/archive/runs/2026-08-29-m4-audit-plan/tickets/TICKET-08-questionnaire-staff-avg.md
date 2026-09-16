# TICKET-08: Questionnaire staff avg (M-03)

- **Спека:** SPEC-05
- **Проблемы:** M-03 (`projects.py:508` `select … where project_id==…` для staff без `user_id` → heavy 90k JSON, без avg)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** M
- **Зависимости:** TICKET-03
- **Можно параллельно с:** TICKET-06,09

## Проблема
`projects.py:508` для `is_cntr_staff` — `qr_stmt = select(QuestionnaireResult).where(project_id==…)` без `user_id` → staff получает все строки (`A 90 B 30 lvl1` →2 rows) без `user_id` в out и без `avg` — при 10k участниках 90k объектов в одном `GET /projects/{id}`.

## Требуемый результат
`GET /projects/{id}` без `all` staff → `[{"level_id":1,"avg_percentage":60.0,"members_count":2}]`, `?all=1` → все строки с `user_id` (2 rows 90/30). Member → только `where user_id==current` 1 row.

## Объём работ
- `read app/api/v1/projects.py:508` + `app/schemas.py` `QuestionnaireResultOut`.
- Добавить в `get_project_detail(request: Request, project_id, db, user, all: bool = Query(False))` ветвление:
  - if `is_cntr_staff(user)` and not `all`: `select QuestionnaireResult.level_id, func.avg(QuestionnaireResult.percentage).label("avg_percentage"), func.count().label("members_count") where project_id==… group_by level_id`
  - elif `is_cntr_staff` and `all`: `select … where project_id==… order_by level_id, user_id` + `user_id` в out
  - else: `where user_id==user.id` (уже)
- `app/schemas.py` добавить `QuestionnaireResultOut.user_id: int | None = None` + `avg_percentage: float | None` + `members_count: int | None` или новый `QuestionnaireAggregatedOut` — выбрать один, коммент Q-02.
- Обновить `tests/test_questionnaire_isolation.py` на новый контракт.

## Не входит
`target_level` логика, `P-15 batch`, `technologies` (TICKET-09).

## Компоненты
- Файлы: `app/api/v1/projects.py`, `app/schemas.py`, `app/db/models.py` (не менять `nullable=False` уже)

## План
1. `read projects.py:508` + `schemas.py`.
2. Edit `get_project_detail` avg + `all` param.
3. Edit `schemas.py` out.
4. `pytest tests/test_questionnaire_isolation.py` обновить.

## Пограничные случаи
- `?all=1` без staff → 403? Нет, member видит только своё — игнор `all`.
- Пустой проект → `avg` пустой список.

## Тесты
- `tests/test_questionnaire_isolation.py` — `admin GET` без `all` → avg 60 count 2, `?all=1` →2 rows с `user_id`.

## Критерии приёмки
- [ ] `GET /projects/{id}` staff без `all` → avg+count, `?all=1` →2 rows с `user_id`.
- [ ] `GET member` 1 row.
- [ ] `pytest test_questionnaire_isolation` PASS.

## Команды проверки
- `.venv/bin/pytest tests/test_questionnaire_isolation.py -v`
- `.venv/bin/mypy app && .venv/bin/ruff check app`

## Риски
- `QuestionnaireResultOut` без `user_id` — старый frontend сломается — добавить `user_id` опционально.
