# Тикет 04 — Индексы и пагинации 5К 20 (P-05,P-06,P-07,P-08)

**Требования:** R13,R14,R15,R16
**Зависит от:** —
**Зона:** `alembic/versions/0028_*`, `app/api/v1/nioktr.py:56,76,114`, `app/api/v1/projects.py:212`, `app/api/v1/executors.py:119`, `app/db/models.py`

## Задача
`P-05` `trgm GIN` `GIN nioktr_types` `Hash ogrn` `0027` образец, `P-06` `LATERAL` `nioktr.py:76`, `P-07` `LIMIT 20` `27-` `nioktr.py:114`, `P-08` `keyset after_id` `projects.py:212`.

## Приёмка
- [ ] `alembic upgrade/downgrade` `0028` `Hash/B-Tree` индексы `GIN`
- [ ] `pytest` `loadtest.py` `714 RPS 5К` `p95 500мс`

## Связи
`spec Истории 11-14` `25-` `27-`
