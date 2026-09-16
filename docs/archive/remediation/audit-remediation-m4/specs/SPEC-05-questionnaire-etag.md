# SPEC-05: Чтение анкеты и кэш реестров — масштабируемость (M-03, I-02, L-02)

## Контекст
`M-03` `technozrelost-backend/app/api/v1/projects.py:508` `qr_stmt = select(QuestionnaireResult).where(project_id==…)` для `is_cntr_staff` без `user_id` фильтра — staff получает все строки проекта (`member A 90% lvl1` + `member B 30% lvl1` → 2 rows) без `user_id` в `QuestionnaireResultOut` и без `avg` — при 10k участниках ×9 уровней =90k объектов JSON в одном `GET /projects/{id}` (heavy). `I-02` `app/api/v1/technologies.py:44` `etag_payload = "|".join(f"{tech.id}…{tech.created_at}" for tech, _ in rows)` строит `md5` по всем `Technology` без учёта `limit/offset` — `GET /technologies?limit=20` ETag одинаков для разных страниц, кэш бьётся на всём реестре O(N). `L-02` `app/api/v1/files.py:147` `fallback = raw.encode("ascii","replace").decode().replace('"',"_"); fallback = re.sub(r'[\r\n\"]', "_", fallback)` — двойная замена `"` избыточна. Затронуты `app/api/v1/projects.py`, `app/schemas.py`, `app/api/v1/technologies.py`, `app/api/v1/files.py`.

Текущее неправильно: staff heavy JSON без пагинации/агрегата, technologies ETag не per-page, fallback dedup.

## Цель
Staff по умолчанию видит `avg(percentage) GROUP BY level_id` + `members_count`, `?all=1` — все строки с `user_id`; `technologies` ETag per page `limit/offset` с `Vary`; fallback один `re.sub`.

## Не входит
Изменение `target_level` логики, `P-15 batch` 500, `nginx` (SPEC-03), замена `pymupdf`.

## Функциональные требования
- `FR-01` `GET /projects/{id}` без `all` для `cntr_admin/manager` → `questionnaire_results` агрегированы: `[{"level_id":1, "avg_percentage":60.0, "members_count":2}, …]` (или `avg` + `count` в `QuestionnaireResultOut` с `user_id=None`). `?all=1` (или `?verbose=1`) → все строки с `user_id` (как сейчас `test_questionnaire_isolation` ждёт 2 rows). Member (`gk_customer`/`rd_executor`) → только `where user_id==current` (уже) 1 row.
- `FR-02` `GET /technologies?limit=20&offset=0` → `ETag = md5(page_rows payload)` + `Vary: Accept-Encoding` + `Cache-Control: private` при `Authorization` else `public` + `If-None-Match == ETag (page)` →304 per page, разные `offset` → разные ETag.
- `FR-03` `GET /projects/{id}` ETag? Не требуется — только `technologies`/`achievements`/`news/categories` (уже).
- `FR-04` `files.py:147` `fallback = re.sub(r'[\r\n\"]', "_", raw_name.encode("ascii","replace").decode())` — одна строка, `grep -c 'replace(\'"\''` 0.

## Нефункциональные
- Производительность: `GET /projects/{id}` staff без `all` — `GROUP BY level_id` с `ix_questionnaire_results_project_level_user` (уже), не 90k rows.
- Совместимость: `test_questionnaire_isolation` обновить на новый контракт (avg), старый `admin 2 rows` остаётся за `?all=1`.

## Техническое решение
- `app/api/v1/projects.py:508` `get_project_detail(request: Request, project_id, db, user, all: bool = Query(False))` — если `is_cntr_staff` и не `all`: `select QuestionnaireResult.level_id, func.avg(QuestionnaireResult.percentage).label("avg_percentage"), func.count().label("members_count") … group_by level_id`; иначе если `is_cntr_staff` и `all`: `select … where project_id==… order_by level_id, user_id` + добавить `user_id` в out; иначе member: `where user_id==user.id`.
- `app/schemas.py` `QuestionnaireResultOut` добавить `user_id: int | None = None` и `avg_percentage: float | None` опционально, или новый `QuestionnaireAggregatedOut` — выбрать один, задокументировать в `schemas.py` коммент «Q-02 staff avg».
- `app/api/v1/technologies.py:44` — перед `etag_payload` уже есть `rows = result.all()` с `limit/offset` в `stmt` — `etag_payload` уже per page, но сейчас `stmt` без `limit/offset`? Проверить: `stmt` уже с `limit/offset` из `Query` — тогда ETag per page уже, только доку. Если нет — добавить `stmt.limit(limit).offset(offset)` перед `execute`. В `spec.md` проверить что `stmt` пагинирован.
- `app/api/v1/files.py:147` заменить 2 строки на 1 `re.sub`.

## Сценарии
- **Given** проект с A90 B30 lvl1, **When** `admin GET /projects/id` без `all` **Then** `[{"level_id":1,"avg_percentage":60.0,"members_count":2}]`.
- **Given** `admin GET /projects/id?all=1` **When** **Then** 2 rows с `user_id` 90 и 30.
- **Given** `member A GET` **When** **Then** 1 row 90, `member B` 30.
- **Given** `GET /technologies?limit=2&offset=0` дважды **When** второй с `If-None-Match` page ETag **Then** 304, `offset=2` другой ETag 200.
- **Given** `file_name='a\r\nb"c'` **When** `GET /files/id/download` **Then** `Content-Disposition filename="a__b_c"` без `"` и CRLF.

## Безопасность
- `user_id` в out только для staff с `require_project_access` уже — не leak для outsider (outsider 404).

## Тестирование
- `tests/test_questionnaire_isolation.py` обновить: `test_questionnaire_per_user_read_isolation` staff без `all` → avg, `?all=1` →2 rows + `test_performance_indexes` остаётся.
- `tests/test_technologies_etag.py` — per page 304/200.
- `tests/test_header_remediation.py` fallback CRLF остаётся.

## Критерии приёмки
- [ ] `GET /projects/{id}` staff без `all` → avg+count, `?all=1` →2 rows с `user_id`.
- [ ] `GET /technologies?limit=2&offset=0` ETag per page, `Vary` present, 304 per page.
- [ ] `grep 'replace(\'"\''` в `files.py` 0, один `re.sub`.

## Definition of Done
FR, тесты, `ruff/mypy` pass, `pytest test_questionnaire_isolation` PASS, доки `schemas.py` коммент.
