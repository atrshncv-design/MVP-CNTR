# Отчёт таска 06 — Производительность

Дата: 2026-08-25 · Исполнитель: субагент прогона deploy-readiness-audit
Контур: prod-стек (nginx :443 self-signed, backend×2, pg primary/replica, redis, minio).
БД контура засеяна демо-данными для осмысленных замеров: 10 проектов (9 опубликованных), 891 организация, 4 000 карточек НИОКТР, 200 load-пользователей (`reset_demo --seed-only` c APP_ENV=development в exec; полный массив 16 582 карт не заливался — диск докер-VM 16 ГБ, см. C1).

## 1. Адаптация нагрузочного сценария (README-LOADTEST.md)

Сценарий `scripts/loadtest.py` устарел против текущих эндпоинтов и был исправлен:

- **Все пути действий были без префикса `/api/v1`** — против текущего стека профиль бил мимо API: «чтения» получали 404 от бэкенда или 200 от Next.js-фронтенда через nginx (ложные 100% ok), записи падали 422. Префикс добавлен.
- Добавлены эндпоинты таска 07: `GET /api/v1/news`, `GET /api/v1/achievements/catalog`, карточка `GET /api/v1/projects/{pid}` (в read-корзину).
- Флаг `--insecure` (self-signed сертификат nginx) и режим `--bench-login N` (замер POST /auth/login — в основном профиле логина нет).

## 2. Результаты прогонов (200 пользователей × 90 с, think 0.5–3 c)

Масштаб: README описывает 1000×120 с; локально контур ограничен 2 vCPU докер-VM, поэтому зафиксирован профиль 200×90 с + лестница 60/150/200.

### До правок (loadtest_before.json)

| Эндпоинт | rps¹ | p50 | p95 | p99 |
|---|---|---|---|---|
| GET /projects/registry | ~11 | 1597 | 6238 | 9227 |
| GET /nioktr?limit=20 | ~7.7 | 1619 | 6181 | 8102 |
| GET /executors/specialists | ~3.8 | 1730 | 6627 | 8871 |
| GET /executors/organizations | ~3.6 | 2675 | 6775 | 8878 |
| GET /projects/{pid} (карточка) | ~1.5 | 1532 | 5956 | 7795 |
| POST /auth/login (bench 100 парал.) | 4.4 | ~10900 | — | ~29500 |
| Итого read | — | 1605 | **6195** ❌ | 8714 |

### После правок (loadtest_after.json, финал)

| Эндпоинт | rps¹ | p50 | p95 vs цель <500 мс |
|---|---|---|---|
| GET /projects/registry | ~13 | 1145 | 4790 ❌ (было 6238) |
| GET /nioktr?limit=20 | ~8.7 | 1182 | 4689 ❌ (6181) |
| GET /executors/specialists | ~4 | 1209 | 4876 ❌ (6627) |
| GET /executors/organizations | ~4 | 1892 | 4963 ❌ (6775) |
| GET /projects/{pid} | ~0.8 | 926 | 4008 ❌ (5956) |
| GET /news | ~4.6 | 1226 | 5103 ❌ |
| GET /achievements/catalog | ~4.5 | 798 | 4001 ❌ |
| POST /auth/login — одиночный | — | ~300 | **300 ✅** |
| Итого read | — | 791 | **3504** ❌ (было 6195) |

¹ rps эндпоинта = доля n за 93 с прогона. Полные p50/p95/p99/rps по каждому эндпоинту — `reports/loadtest_before.json`, `reports/loadtest_after.json`.

### Ключевые точки насыщения

- **60 пользователей**: p50 8–15 мс, p95 ≤ 56 мс по всем эндпоинтам — **цель <500 мс выполняется с запасом**.
- **≥150–200 пользователей**: плато ~55–61 rps контура, равномерный рост латентности всех эндпоинтов (очередь). Причина измерена: прямой прогон внутрь сети docker на backend показал то же плато при CPU backend-контейнера ≈ 89% одного ядра, БД при этом <15% — узкое место = 1 uvicorn-воркер на ядро, 2 vCPU на всю VM.
- **POST /auth/login всплеском (200 одновременных)**: p50 ≈ 10.9 с — чистая математика bcrypt (~250 мс CPU/логин × 200 на 2 ядра); устойчиво 4.4 логина/с. Одиночный/редкий вход — 0.3 с, в норме.

## 3. Топ узких мест: сделано / реестр

| # | Узкое место | Решение |
|---|---|---|
| F06-01 | Пул SQLAlchemy дефолтный (5+10 соед.) при 1 воркере — очередь checkout'а давала равномерные +1.5 c | **исправлено**: `db_pool_size=20`/`db_max_overflow=30` (env-настройки, `pool_options()`), тест `tests/test_db_pool.py` |
| F06-02 | Синхронный bcrypt блокировал event loop (регистрация/логин) | **исправлено**: `run_in_threadpool` в register/login (`app/api/v1/auth.py`), auth-тесты зелёные |
| F06-03 | N+1 в карточке проекта: `db.get(User)` на каждый верифицирующий документ | **исправлено**: один пакетный запрос имён (`projects.py:get_project_detail`), тест-страж `tests/test_project_card_perf.py` |
| F06-04 | Нет индексов под горячие пути: реестр проектов (partial WHERE is_public), category, project_members.user_id, nioktr created_date/org, news status+published_at | **исправлено**: миграция **0027_performance_indexes** (+downgrade, зеркала в models.py), тест через pg_indexes `tests/test_performance_indexes.py`; применена на тестовую БД (up/down/up проверен) и на БД контура entrypoint'ом |
| F06-05 | Ёмкость контура ~60 rps: 1 uvicorn-воркер/контейнер на 2 vCPU; цель README ≥500 rps недостижима на этой VM | **реестр, рекомендация**: воркеры `--workers N` нельзя включить наивно — news-scheduler в main.py стартует на процесс и задублирует публикации; нужен env-guard/лидер или вынос шедулера. Выигрыш: ~линейный по ядрам |
| F06-06 | Реестры без пагинации (`/projects/registry`, `/executors/*` отдают всё) | **реестр**: контракт ответа менять рискованно для фронта; при росте данных — keyset-пагинация. Индекс 0027 частично смягчает сортировку |

Эффект фиксов на замерах: p95 read 6195→3504 мс (−43%) при том же профиле; при 60 пользователях p95 ≤56 мс. Оставшиеся секунды на 200 пользователях — F06-05 (CPU-насыщение), не SQL: БД <15% CPU.

## 4. Первая загрузка фронтенда

Сборка `next build`: ✓ lint ✓ node --test 23/23 ✓ build. Колонка First Load JS в этом Next не печатается — замер фактической первой загрузки через nginx (HTML + все /_next ассеты):

| Страница | HTML | Ассеты (wire) | Сумма | Время документа |
|---|---|---|---|---|
| `/login` | 11.3 КБ | 687 КБ | **≈ 0.70 МБ** | 48 мс |
| `/` | 59 КБ | 865 КБ | **≈ 0.92 МБ** | 20 мс |

На канале 10 Мбит/с ≈ 0.6–0.8 с transfer + рендер — **укладывается в цель <2–3 с**. Самый крупный чанк 320 КБ (`39upc1ru2uz_v.js`) — кандидат на code-splitting (низко).

## 5. Инциденты во время работ

- C1: сид полного массива НИОКТР (16 582) переполнил диск докер-VM (16 ГБ): pg_wal «No space left», primary ушёл в restart-loop. Восстановлен очисткой docker build cache (−4 ГБ), залит подмассив 4 000 карт. Диск остаётся на 79% — риск для будущих тяжёлых операций.
- C2: clamav unhealthy — вне зоны таска (подтверждено брифом).

## 6. Критерии приёмки

- [x] Таблица нагрузочного прогона (эндпоинт, rps, p95) vs цель <500 мс — §2
- [x] Топ узких мест: 4 исправлено (F06-01..04), 2 в реестре с оценкой (F06-05..06)
- [x] Backend pytest 257→**266 passed**; frontend lint/test(23)/build зелёные
- [x] Первая загрузка главной и входа измерена (§4)
- [x] Миграции применяются на чистой БД (conftest upgrade head) и down/up на БД с данными; 0027 применён entrypoint'ом на контуре с данными

## 7. Дозапрос (ремонт после ревью, таск 06)

Три условия дозапроса закрыты; коммитов нет — изменения в рабочем дереве.

**7.1. Несовпадение формы сортировки ленты и индекса (F06-04, ремонт).**
Индекс `ix_news_posts_status_published` построен как `(status, published_at DESC NULLS LAST, id DESC)`,
а запрос ленты сортировал `published_at.desc()` без nullslast — в PG `DESC` по умолчанию означает
`NULLS FIRST`, планировщик добавлял `Sort`. Выровнен **запрос**: добавлен `.nullslast()` в
`app/api/v1/news.py` (лента). Обоснование: колонка nullable (draft/scheduled хранят NULL), прецедент
конвенции уже есть в nioktr.py (`created_date.desc().nullslast()` под такой же индекс), и правка
запроса не требует DDL-хирургии уже применённой на контуре миграции.

EXPLAIN ленты (technozrelost_test, 6000 published + 1500 draft, форма запроса из news.py):

```
ДО фикса (ORDER BY published_at DESC без NULLS LAST):
  Limit
    ->  Sort
          Sort Key: published_at DESC, id DESC          ← лишний узел
          ->  Index Only Scan using ix_news_posts_status_published
                Index Cond: (status = 'published')

ПОСЛЕ фикса (.nullslast()):
  Limit
    ->  Index Scan using ix_news_posts_status_published on news_posts
          Index Cond: ((status)::text = 'published'::text)   ← Sort исчез
```

**7.2. Дроп поглощённого `ix_news_posts_status`.** Одиночный btree из 0024 поглощён левым
префиксом `(status)` композита — любой план одиночного индекса доступен через композит.
Дроп добавлен в `db/migrations/sql/0027_performance_indexes.sql`; downgrade восстанавливает
исходное определение. Down/up на БД с данными проверен: после раундтрипа `ix_news_posts_status`
отсутствует, композит и остальные пять индексов на месте. Попутно пойман и исправлен дефект:
PG не принимает schema-префикс имени индекса с `IF NOT EXISTS` (syntax error при downgrade).

**7.3. Гард N+1 получил силу.** `tests/test_project_card_perf.py::test_detail_query_count_bounded`:
счётчик SQL statement'ов через `event.listen(engine.sync_engine, "before_cursor_execute")` вокруг
GET карточки; 8 документов с РАЗНЫМИ uploader'ами сидируются напрямую через psycopg (при общем
uploader'е identity map гасит `db.get()` и гард слеп). Ассерт: ≤14 запросов (замер базы — 11,
не зависит от числа документов). Проверка силы: временная реинкарнация построчного `db.get(User)`
даёт 26 запросов → тест красный; с пакетным кодом — зелёный.

Проверка дозапроса: `uv sync --extra dev && uv run pytest -q` → **268 passed** (было 266, +2 теста),
ruff check app tests — чисто.
