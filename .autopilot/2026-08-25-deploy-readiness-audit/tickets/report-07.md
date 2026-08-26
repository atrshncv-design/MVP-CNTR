# report-07 — Перенос новостей и достижений на платформенный бэкенд

## Статус

DONE. Модули news и achievements перенесены из старой линии (корневые `app/`,
`alembic/`, `db/` — read-only источники) в `technozrelost-backend` без изменений
фронта. Все критерии приёмки закрыты.

## Реестр изменений (перенесено)

| Файл | Что |
|---|---|
| `app/db/models.py` | +8 моделей: NewsCategory, NewsTag, news_post_tags_tbl, NewsPost, NewsPostMedia, Achievement, UserAchievement, ProjectAchievement (адаптированы под стиль платформы: server_default="false", Index/UniqueConstraint импорты) |
| `db/migrations/sql/0024_news.sql` … `0026_achievement_awards.sql` | SQL из старой линии (0027–0029) 1:1; в 0025 добавлен идемпотентный seed каталога: INSERT…66 медалей ON CONFLICT (slug) DO UPDATE (сгенерирован программно из `_CATALOG`) |
| `alembic/versions/0024_news.py`, `0025_achievements.py`, `0026_achievement_awards.py` | head платформы теперь 0026 (был 0023) |
| `app/db/seed_achievements.py` | сид-скрипт (`uv run python -m app.db.seed_achievements`), идемпотентный пересев |
| `app/services/html_sanitizer.py` | +`strip_tags` (заголовки/excerpt); все записи контента идут через существующий `sanitize_html` (nh3) |
| `app/services/file_storage.py` | +`store_news_media` (ключ `news/{post_id}/uuid.ext`, сигнатурный MIME, ≤25 МБ) |
| `app/services/notifications.py` | +`notify_news_published` («Новость: {title}» всем активным, Notification+outbox delivered) |
| `app/services/news_scheduler.py` | перенос 1:1; фоновый цикл в lifespan (не в test-env) |
| `app/services/achievements.py` | наградчики целиком (award_document/award_ugt/award_meta/revoke_for_event/achievement_stats) — notify_user совместим |
| `app/schemas.py` | +News*-схемы, Achievement*/UserAchievement*/ProjectAchievementOut, AdminAchievementsStatsOut (+import datetime) |
| `app/api/v1/news.py` | роутер: лента/detail/categories/mine/admin-list/create/patch/publish/schedule/unpublish/delete/media upload+delete. Отличия от источника: убран rate_limit (в платформе модуля нет), `read_upload_limited` вместо read_upload_bounded (FileSizeExceeded→422), sanitize_html из html_sanitizer |
| `app/api/v1/achievements.py` | catalog/mine/project-achievements; get_project_or_404/can_access_project переиспользованы из projects.py |
| `app/api/v1/admin.py` | +GET /admin/achievements/stats (cntr_admin-only, как у фронта cntr_admin/page.tsx) |
| `app/api/v1/stages.py`, `manager.py` | хуки: `_trigger_application` → award_document; `decide_promotion(approve)` → award_ugt + award_meta активным участникам |
| `app/main.py` | роутеры news/achievements/project_router подключены; scheduler-loop в lifespan |
| `tests/conftest.py` | truncate-лист дополнен 8 таблицами модуля |

## Тесты

- Портированы: `test_news.py` (19), `test_news_schedule.py` (7), `test_achievements.py` (8), `test_achievements_stats.py` (5) — адаптаций почти не потребовалось.
- Новый `tests/test_news_contract.py` (5): точные наборы ключей ответов против `news-types.ts` (NewsFeed/NewsCard/NewsDetail/NewsMedia/NewsCategory) и формы achievements (catalog=66, slug=icon_key).
- `uv sync --extra dev && uv run pytest -q` → **257 passed** (было 213). ruff check чисто.

## Миграции (проверено делом)

- Чистая БД: upgrade base→0026, downgrade 0023→0 остатка таблиц, повторный up/down — ок.
- БД контура (tz-prod-db-primary, данные есть): entrypoint применил 0023→0026 после бэкапа; вручную downgrade 0023 (новые таблицы 0) и обратно upgrade head — ок; контур оставлен на 0026, каталог 66 медалей на месте.

## Curl против контура (nginx → backend x2)

- `https://localhost/api/v1/news` → `{"items":[],"total":0,"page":1,"per_page":10}` ✓
- `https://localhost/api/v1/achievements/catalog` → 66 медалей ✓

## Расхождения с фронтом / оговорки

- Расхождений форм не найдено: пути и поля совпадают с news-types.ts/news-admin-api.ts/api-client.ts (подтверждено контракто-тестами).
- `excerpt` в ленте считается strip_tags(content)[:240] — как в источнике.
- rate-limit на публичных чтениях новостей/каталога в платформенном бэкенде отсутствует как механизм (в источнике был registry-limiter) — прикрыто глобальным лимитом тела и nginx; отмечено как потенциальная находка F-уровня «низко», действие — рекомендация.
- Фронтенд не менялся (зона таска — бэкенд); его build не затронут правками.
