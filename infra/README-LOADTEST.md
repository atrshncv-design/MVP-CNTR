# Нагрузочный и security harness (тикет 21)

Воспроизводимый профиль 1 000 виртуальных пользователей и автоматические
security-гейты для серверного окружения. Скрипты живут в `scripts/`, не требуют
изменений приложения и не входят в `app/`.

| Что | Файл |
|---|---|
| Нагрузочный профиль | `scripts/loadtest.py` |
| Security-проверки | `scripts/security_check.py` |
| Юнит-тесты логики harness | `tests/test_harness.py` |

Требования: Python 3.11, `uv`, dev-группа зависимостей
(`uv sync --extra dev` — нужен `httpx`; `psycopg` — только для назначения
staff-ролей). Все команды — из корня репозитория backend, с `export PYTHONPATH=.`.

---

## 1. Нагрузочный профиль (`scripts/loadtest.py`)

### Профиль трафика (1 000 пользователей)

| Корзина | Доля | Действия |
|---|---|---|
| read | 70% | `GET /projects/registry`, `GET /nioktr?limit=20`, `GET /executors/specialists`, `GET /executors/organizations` |
| write (ЛК/опросник) | 20% | `POST /assessments` (опросник, 1 раз на пользователя — переоценка запрещена 403), далее `PATCH /profile`, `GET /projects`, `GET /assessments/mine`, `GET /auth/me` |
| file | 8% | `POST /projects/{id}/files` (валидный PDF по сигнатуре), `GET /projects/{id}/files` — только после создания своего проекта |
| manager | 2% | `GET /manager/queue/drafts` (токен `cntr_manager`) |

Между запросами — think time (по умолчанию 0.5–3.0 с, экспоненциальный).
Каждый виртуальный пользователь — уникальный аккаунт с собственным Bearer-токеном.

### Отчёт

- success rate, p50/p95/p99 и mean (read/write раздельно, ms), throughput req/s;
- разбивка по корзинам и по эндпоинтам;
- цели с подсветкой PASS/FAIL:
  - success rate ≥ 99%;
  - p95 read ≤ 500 ms;
  - p95 write ≤ 1000 ms;
- JSON-отчёт в `reports/loadtest_report.json` (каталог в `.gitignore`).
- exit code: `0` — все цели выполнены, `1` — нет, `2` — прервано.

### Команды

```bash
export PYTHONPATH=.

# 1) Подготовка токенов (однократно, на целевом сервере):
#    регистрирует N пользователей (конкурентно, семофор 20) в .loadtest_tokens.json
uv run python scripts/loadtest.py --base-url http://127.0.0.1:8000 --prepare-users 1000

# 2) Назначить первого пользователя cntr_manager (2% менеджера; роль ЦНТР
#    публичной регистрацией не выдаётся — прямой INSERT зеркалит назначение админом,
#    как tests/support.py). Нужен доступ к БД: POSTGRES_HOST/PORT/USER/PASSWORD/DB.
uv run python scripts/loadtest.py --seed-manager

# 3) Прогон профиля 1000 пользователей
uv run python scripts/loadtest.py --users 1000 --duration 120

# Локальная проверка корректности сценария (малый масштаб)
uv run python scripts/loadtest.py --users 20 --duration 30 --prepare-users 20 --seed-manager
```

Повторный `--prepare-users` идемпотентен: уже зарегистрированные email логинятся
(409 → login), пользователи дописываются.

### Как интерпретировать

- `success rate < 99%` — смотреть `per_endpoint`: массовые 5xx = деградация
  сервиса/БД; точечные 4xx = ошибка сценария (например, повторный `POST
  /assessments` тем же пользователем — при исправном сценарии его нет);
- `p95 read > 500ms` — узкое место чтения (реестры через Replica, N+1,
  медленные запросы). Проверять метрики `/api/v1/metrics` и Grafana;
- `p95 write > 1s` — узкое место записи: bcrypt при регистрации, ClamAV-скан
  при загрузке файлов, MinIO, коммиты БД;
- `throughput req/s` — ёмкость контура: 1000 пользователей × ~1 req / 1.75 с
  ≈ 570 req/s пиковых на ровном профиле; прод-ожидание — не ниже 500 req/s
  при 2 репликах backend;
- файловая корзина не работает, пока пользователь не создал проект
  (опросник) — первые секунды прогона доля file ниже 8%, это нормально.

---

## 2. Security harness (`scripts/security_check.py`)

Пять групп проверок:

| # | Группа | Что проверяет |
|---|---|---|
| 1 | secrets | git-tracked файлы: ключи/пароли/токены (значения ≥12 симв., не плейсхолдеры). Исключены `.env*`, `tests/`, `.venv/`, `node_modules/` |
| 2 | deps | `uv audit` — известные CVE в lockfile; плюс таблица версий ключевых пакетов |
| 3 | RBAC | без токена реестр → 401; клиент → очередь менеджера 403; клиент → admin/audit 403; менеджер → admin/audit 403; менеджер → очередь 200; админ → audit 200 |
| 4 | IDOR | проект и файлы чужого пользователя → 404 (существование скрыто), владелец → 200 |
| 5 | file-security | валидный PDF (сигнатура `%PDF-`) → 201; текст, названный `report.pdf` с Content-Type `application/pdf` → 422 (MIME по сигнатуре, не по имени/заголовку) |

### Команды

```bash
export PYTHONPATH=.
# Полный прогон (нужен живой сервер; staff-роли через демо-аккаунты или БД)
uv run python scripts/security_check.py --base-url http://127.0.0.1:8000
# Только сканы (без API)
uv run python scripts/security_check.py --skip-live
# С сохранением результата
uv run python scripts/security_check.py --json reports/security_check.json
```

Staff-роли: скрипт сначала пробует демо-аккаунты
(`uv run python -m app.db.reset_demo --seed-only`, пароль `DemoPass123!`),
при их отсутствии регистрирует пользователей и назначает роль прямым INSERT
в `user_roles` (нужны переменные `POSTGRES_HOST/PORT/USER/PASSWORD/DB`).

### Как интерпретировать

- любой `[FAIL] SECRETS` — реальный ключ/пароль в репозитории, удалить и
  ротировать значение;
- `[FAIL] DEPS` — известные уязвимости в lockfile: `uv lock --upgrade <pkg>`
  (или `uv remove`/`uv add`) и повторный прогон;
- `[FAIL]` в RBAC/IDOR — нарушение авторизации (ожидаемые коды 403/404,
  получен доступ) — критично, останавливает релиз;
- `[FAIL] FILE` — MIME определяется по имени/заголовку, а не по сигнатуре —
  критично (загрузка произвольного содержимого).

Exit code: `0` — все проверки PASS, `1` — есть FAIL.

---

## 3. Порядок на сервере (первый прогон)

```bash
cd technozrelost-backend
uv sync --extra dev
export PYTHONPATH=.
# 1) демо-аккаунты (для RBAC-проверок) — идемпотентно
uv run python -m app.db.reset_demo --seed-only
# 2) security-гейт
uv run python scripts/security_check.py --base-url http://127.0.0.1:8000
# 3) подготовка токенов 1000 пользователей
uv run python scripts/loadtest.py --prepare-users 1000 --seed-manager
# 4) прогон
uv run python scripts/loadtest.py --users 1000 --duration 120
```

AI-консультант (`/api/v1/chat`) в нагрузочном профиле НЕ участвует —
тестируется отдельно (rate limit 30 req/60s на пользователя, тикет 14).

## Известные advisories (security_check)

- `ecdsa 0.19.2` — CVE-2024-23342 (Minerva timing attack, P-256). **Фикса нет**;
  приходит транзитивно через `python-jose` (JWT). Мониторинг на сервере;
  план — переход на PyJWT при ближайшем релизе.
- `rsa` — пакет архивирован (adverse status, не уязвимость); транзитивно от
  python-jose.
