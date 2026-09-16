# TICKET-11: ETag Vary и private (M-03, L-06)

- **Спека:** SPEC-05
- **Проблемы:** M-03 (ETag без Vary/private), L-06 (technologies без кэша)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-06,07,08,09

## Проблема
`achievements.py:75`/`news.py:327` `Cache-Control: public, max-age=300` без `Vary`/`private` → публичный кэш может отдать `Authorization` response; `ETag` без `sort_order` → 304 на старый порядок; `technologies` без ETag.

## Требуемый результат
`Vary: Accept-Encoding`, `private` когда `Authorization`, `sort_order` в ETag, `technologies` ETag если существует.

## Объём работ
- `app/api/v1/achievements.py:75` `etag_payload = "|".join(f"{a.id}:{a.slug}:{a.sort_order}:{a.updated_at...}"` + `response.headers["Vary"]="Accept-Encoding"` + `if request.headers.get("authorization"): cache="private, max-age=300" else "public, max-age=300"`.
- `app/api/v1/news.py:327` аналогично.
- `app/api/v1/technologies.py` — если `GET /technologies` существует, добавить тот же ETag 300s, иначе skip.
- Тесты: `grep Vary` .

## Не входит
Nginx forwarding (TICKET-09), CSP (TICKET-12).

## Компоненты
- Файлы: `app/api/v1/achievements.py`, `app/api/v1/news.py`, `app/api/v1/technologies.py` (опц.)

## План
1. `read achievements.py:58..80`.
2. Добавить `sort_order` в payload, `Vary`, `private` логику.
3. `read technologies.py` — есть ли `router.get("")`?
4. `ruff/mypy`.

## Пограничные случаи
- `If-None-Match` с `W/` → exact match уже.
- `Authorization: Bearer` vs `authorization` lower — Starlette case-insensitive, `request.headers.get("authorization")` lower.

## Тесты
- `test_catalog_vary_and_private` — `GET` anon → `Vary`, `Cache-Control public`; `GET` с `Authorization` → `private`.
- `test_catalog_etag_changes_on_sort_order`.

## Критерии приёмки
- [ ] `Vary` header present.
- [ ] `private` when auth.
- [ ] `sort_order` в `etag_payload`.
- [ ] `technologies` ETag если роут есть.

## Команды проверки
- `.venv/bin/pytest tests/test_catalog_remediation.py -q`
- `.venv/bin/ruff check app`

## Риски
- `private` снижает hit ratio публичного кэша, но корректно — `public` для anon остаётся.
