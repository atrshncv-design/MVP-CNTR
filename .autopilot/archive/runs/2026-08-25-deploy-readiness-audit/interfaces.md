# Интерфейсы прогона

## Рабочая копия прогона

**Все правки кода — только в:** `/Users/aleksandrtrisenkov/Desktop/ЦЕНТР ТЕХНОЛОГИЧЕСКОГО РАЗВИТИЯ/MVP ПЛАТФОРМЫ 2/.worktrees/deploy-readiness`
Ветка: `autopilot/deploy-readiness-code` (база: friday-rc c89ebb7 + фронт a05e6a6, консолидация `43a98ce`).
Коммиты делает оркестратор — исполнитель оставляет изменения в рабочем дереве и НЕ коммитит.
БД для тестов сейчас не запущена: поднять штатно — `docker compose -f technozrelost-backend/infra/docker-compose.yml up -d db db-replica` (из рабочей копии прогона), не менять конфиги.

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `findings` | реестр находок всех доменов | формат записи: `{id, область, файл:строка, severity, описание, действие}` | группировку и приоритизацию |
| `verify` | определение «зелёного» состояния | команды проверки (ниже) | интерпретацию падений |

Прогон — аудит и точечные исправления поверх существующей архитектуры; новых модулей нет. Швы для проверок — только существующие: pytest бэкенда, lint/tsc/build фронтенда.

## Правила проекта для исполнителей

- **База:** ветка `autopilot/deploy-readiness-audit`, актуализированная на `origin/main`. На `main` не коммитить, историю не переписывать, ветки не удалять.
- **Стек:** backend — Python 3.11+, FastAPI, SQLAlchemy (async), Alembic, uv (`technozrelost-backend/`); frontend — Next.js (App Router), npm (`technozrelost-frontend/`); инфраструктура — Docker Compose (`technozrelost-backend/infra/`).
- **Команды проверки:** backend — `uv run pytest -q` (и `uv run ruff check app`, если настроено); frontend — `npm run lint`, `npm test`, `npm run build`. Сборку фронта делать при остановленном dev-сервере (известная ловушка: сборка при живом dev ломает NextAuth-роуты).
- **БД для тестов:** штатный compose проекта (`technozrelost-backend/infra/docker-compose.yml`, primary :5432, replica :5433). Конфиги compose не менять ради тестов.
- **Секреты:** значения из `.env*` никогда не копируются в отчёты, реестры, логи и коммиты — только имена переменных. Новые секреты не запрашивать.
- **Неотслеживаемые файлы** пользователя не удалять и не перемещать. Удалять можно только отслеживаемое git (восстановимо).
- **Зависимости:** недостающая зависимость возвращается как `BLOCKED` с указанием имени пакета — не устанавливать молча.
- **Реестр находок** (единый формат для всех тасков): `{id, область, файл:строка, severity(критично|высоко|средне|низко), описание, действие(исправлено|рекомендация)}`. Прикладывается к отчёту таска в `.autopilot/<dir>/tickets/report-NN.md`.
- **Правки:** безопасное — чинить с проверкой тестами; рискованные переработки — только находка в реестре с рекомендацией.

## Из таска 01 — зелёная база

- Сьюты на консолидированной базе зелёные: backend `uv run pytest -q` → 191 passed; frontend lint ✓ / node --test 20 ✓ / next build ✓
- compose-сервисы БД называются `pg-primary`/`pg-replica` (НЕ db/db-replica)
- На свежей рабочей копии нужны `uv sync --extra dev` и `npm install`
- Роль replicator на primary отсутствует, если том БД создан до init-скрипта: лечится рантайм-SQL, чинить по-настоящему — таск 05

## Из таска 02 — гигиена

- Легаси выведены из дерева: 294 файла (MVP-0, docs/.scratch) — коммит 0e612c9
- `docs/version-map.md` — карта веток и судеб; `.gitignore` корня объединён с main без битых строк (babc9b9)
- Остатки мусора под наблюдением: docx-дубли (F02-06/07), docs/docs/agents — только находки

## Из таска 03 — безопасность фронта

- CSP + 5 security-заголовков задаются в next.config.ts `headers()` (источник истины фронта); nginx проксирует CSP без изменений
- `.env.example` фронта создан; пустой NEXT_PUBLIC_API_URL даёт connect-src 'self' — за nginx корректно
- Скан git-истории: секретов нет, отзыв ключей не нужен; CI-воркфлоу на базе отсутствует — портировать repo-hygiene.yml при merge (решение владельца)

## Из таска 04 — безопасность бэкенда (+2 ремонта)

- auth_throttle: ключ = X-Real-IP → последний hop XFF → client.host (за nginx подделать нельзя)
- nh3-санитайзер (`html_sanitizer.py`) готов и покрыт тестами; живых вызовов нет — подключается одной строкой при портировании новостного модуля
- F04-12 (высоко): фронт зовёт /api/v1/news — роутера в technozrelost-backend нет (есть в корневой копии app/) → см. D02 манифеста
- Коды ответов изменены намеренно: oversize upload 422→413; download при scan error/pending 200→409 (fail-closed)
- Канонический запуск тестов: `uv sync --extra dev && uv run pytest -q` (голый sync сносит dev-экстры)

## Из таска 05 — инфраструктура (+ремонт)

- Прод-контур поднимается `./deploy.sh`; health/readiness зелёные; контур ОСТАВЛЕН ЗАПУЩЕННЫМ для таска 06
- backup.sh переносим (GNU/BSD), guard пустого ввода; restore проверен сверкой row-counts
- Security-заголовки: источник истины — nginx (proxy_hide_header дублей FastAPI), HSTS 63072000 единственный
- Секреты для сервера (заполнить владельцу в infra/.env.production): POSTGRES_PASSWORD, REPL_PASSWORD, MINIO_SECRET_KEY, GRAFANA_ADMIN_PASSWORD, NEXTAUTH_URL, CORS_ORIGINS, LLM_API_KEY

## Из таска 07 — перенос новостей и достижений

- Каноничный бэкенд: technozrelost-backend (решение владельца G01); корневые app//alembic — архивная линия, только чтение
- Новые эндпоинты: /api/v1/news* (лента, категории, publish/schedule/unpublish, media, admin-list) и /api/v1/achievements/{catalog,mine}, /projects/{id}/achievements, /admin/achievements/stats
- Миграции 0024–0026 применяются entrypoint'ом автоматически при старте контура; сид медалей идемпотентен
- Весь HTML-контент новостей проходит html_sanitizer.sanitize_html на обеих точках записи
- Под наблюдением (concerns): дубликат каталога медалей в seed_achievements.py и 0025_*.sql может разъезжаться; 422-vs-413 для oversize в news.py против files.py; награды опоздавшим участникам при повторном событии; rate-limit на публичных чтениях отсутствует

## Из таска 06 — производительность

- Пул БД настраивается env: db_pool_size / db_max_overflow (database.py pool_options(), NullPool в тестах сохранён)
- bcrypt уходит в run_in_threadpool (auth.py); N+1 карточки проекта закрыт батч-запросом + гард-тест со счётчиком запросов (бюджет 14)
- Миграция 0027: 6 индексов под реальные фильтры реестров/ленты + дроп поглощённого ix_news_posts_status; сортировка ленты выровнена с индексом (.nullslast())
- loadtest.py починен (пути /api/v1), флаги --insecure/--bench-login; цифры воспроизводимы из репо
- Замер: p95 ≤ 56 мс @ 60 пользователей ✅; плато ~60 rps — CPU одного uvicorn-воркера на 2 vCPU (F06-05: наивный --workers дублирует news-scheduler)
- Первая загрузка страниц ≈0,7–0,92 МБ (< 2–3 с ✅)
