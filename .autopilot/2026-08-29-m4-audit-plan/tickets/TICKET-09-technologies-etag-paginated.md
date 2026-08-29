# TICKET-09: Technologies ETag per page (I-02)

- **Спека:** SPEC-05
- **Проблемы:** I-02 (`technologies.py:44` ETag по всем `Technology` O(N) без пагинации)
- **Приоритет:** P2
- **Критичность:** Info
- **Сложность:** M
- **Зависимости:** —
- **Можно параллельно с:** TICKET-08,10

## Проблема
`etag_payload = "|".join(f"{tech.id}…{tech.created_at}" for tech, _ in rows)` где `rows = result.all()` с `limit/offset` в `stmt`? Если `stmt` без `limit/offset`, ETag по всем Technology — `GET /technologies?limit=20` ETag одинаков для разных страниц, кэш бьётся на всём реестре O(N) при 10k.

## Требуемый результат
`GET /technologies?limit=20&offset=0` → `ETag = md5(page_rows)` + `Vary: Accept-Encoding` + `Cache-Control: private` при `Authorization` else `public` + `If-None-Match == ETag(page)` →304 per page, разные offset → разные ETag.

## Объём работ
- `read app/api/v1/technologies.py:44` → проверить `stmt.limit(limit).offset(offset)` перед `execute`.
- Если нет — добавить `stmt = stmt.limit(limit).offset(offset)` перед `result = await db.execute(stmt)`.
- `etag_payload` уже per page (из `rows` страницы) — убедиться коммент `L-06/P-09 per page`.
- `Vary` и `Cache-Control` уже — не менять.

## Не входит
`target_level` логика, `fallback` (TICKET-10).

## Компоненты
- Файл: `app/api/v1/technologies.py:44`

## План
1. `read technologies.py` → `stmt` + `rows`.
2. Edit: ensure `limit/offset` + коммент per page.
3. `pytest tests/test_technologies*` per page.

## Пограничные случаи
- `limit=0` → 400 validation.
- `If-None-Match` для другой страницы →200 не 304.

## Тесты
- `tests/test_technologies_etag_paginated.py` — `limit=2 offset=0` ETag 1, `offset=2` ETag 2, `If-None-Match` page →304.

## Критерии приёмки
- [ ] `GET /technologies?limit=2&offset=0` ETag 1, `offset=2` ETag 2, `If-None-Match` page →304 per page.
- [ ] `Vary` present.

## Команды проверки
- `.venv/bin/pytest tests/test_catalog_remediation.py -v`
- `grep -n "limit.*offset" technozrelost-backend/app/api/v1/technologies.py`

## Риски
- `stmt` без `limit` — full scan при 10k.
