# MVP-деплой «Технозрелости»: минимум, Day-1, backlog

Пилот: десятки пользователей, облако РФ, всё сразу в сжатом виде = без Replica.
Код не меняем. Секреты — только именами, значений здесь нет.

## 1. Минимум мощностей (Day-1, одна виртуалка)

| Ресурс | Минимум (стартует) | Комфорт пилота | Из чего сложено |
|---|---|---|---|
| vCPU | 4 | 6–8 | backend 1.0 (лимит в compose) + ClamAV до 2.0 (лимит) + PG ~1–2 + frontend ~0.5–1 + nginx/redis/minio/monitoring ~1.5 + ОС. Методика прошлой спеки: ~67 RPS/ядро, пилот — единицы RPS, API ест ~0.1–0.3 ядра |
| RAM | 16 ГБ | 16–24 ГБ | backend 2G (лимит) + ClamAV 4G (лимит, реально ~2 с сигнатурами) + PG 2–4 + frontend ~1–1.5 + redis 0.5 + minio 0.5–1 + prometheus/grafana ~1.5 + ОС 2. Норма — не выше 70–75% |
| Диск | 120 ГБ SSD/NVMe usable | 200 ГБ | PG + индексы + WAL ~20 + файлы (пилот << 1 ГБ/день, запас на 3–6 мес) + бэкапы + WAL-архив + логи/мониторинг ~10 + ОС/образы ~20; правило прошлой спеки: +30% версии/мета, /0.8 свободное место |
| Сеть публичная | 100 Мбит/с | 100–300 Мбит/с | формула прошлой спеки: 20 RPS × 100 KiB × 8/1024 ≈ 16 Мбит/с |
| Сеть внутренняя | 1 Гбит/с | 1–10 Гбит/с | Replica-трафика в Day-1 нет; WAL/бэкап/ClamAV — внутри узла |

Потолок пилота на этом минимуме: до ~50 concurrent, ~10–20 RPS sustained, файлы до ~1 ГБ/день.
Триггеры докупки (любой из них): CPU >70% 5 мин, RAM >75%, диск >80%, RPS >20 sustained,
PG >100 ГБ, concurrent >50, бэкап не укладывается в окно. Действие: +Replica, +2-я реплика
backend, отдельный диск/бакет под MinIO и бэкапы, дальше — второй узел.

Что сознательно ужато: только Replica (Primary один). Backend — 1 реплика вместо 2
(`deploy.replicas: 2` в прод-компоузе возвращается вторым этапом). Всё остальное — в полном
составе, включая ClamAV, Redis, мониторинг.

## 2. Что публикуем в Day-1 (статус по текущему коду)

Легенда: ГОТОВО — код и шов есть; УСЛОВНО — едет, но с операторским условием.

| Модуль | Day-1 | Шов проверки |
|---|---|---|
| Лендинг-витрина на живых данных | ГОТОВО | публичный `GET /projects/registry` без Authorization, `SHOWCASE_PAGE_SIZE=9` |
| Публичные реестры (НИОКТР, специалисты, организации, registry) | ГОТОВО | `GET /nioktr/*`, `GET /executors/*`, `GET /projects/registry`; лимиты anon/auth, пагинация limit/after_id/offset |
| Auth (регистрация по allowlist, троттлинг, JWT HS256 + NextAuth, атомарный refresh) | ГОТОВО | `POST /auth/*`; чужим привилегированным ролям — 403; `PATCH /users/{id}`, `PATCH /projects/{id}/control-points/{cp_id}` — staff-bypass, чужим 404/403 |
| Проекты/заявки/этапы/оценки/технологии/матчинг/новости/профили/достижения/участники/инвайты | ГОТОВО | роуты `projects/requests/stages/assessments/technologies/match/news/profiles/achievements/membership/invites/manager/admin` под `/api/v1` |
| Файлы (сигнатурный MIME pdf/docx/xlsx/png/jpeg до 25МБ, тело 32m, UUID-имена, MinIO закрытый, ClamAV INSTREAM fail-closed) | ГОТОВО | `POST /projects/{id}/files`, `GET /files/{id}/download`; nginx `client_max_body_size 32m` == бэкенд 32MiB |
| Realtime SSE по одноразовому ticket | ГОТОВО | `POST /notifications/sse-ticket` → ticket TTL 30с; `GET /notifications/stream?ticket=`; токен в query — 400, чужой/used/expired — 401 |
| AI-чат/RAG/матчинг (изоляция промпта, очередь 4, таймауты 8с/2с, строгий парсинг SUCCESS, офлайн-семантика 1536 + reindex) | ГОТОВО | `POST /chat/*`, `POST /rag/search`, `POST /match`; без GPU, внешний OpenAI-совместимый LLM по имени `LLM_API_BASE` |
| Наблюдаемость (`/health`, `/ready` 503 при unavailable, метрики bounded `unmatched`, nginx-зоны registry 100r/s + auth 10r/s, backup-lock fail-closed, alerter, Prometheus/Grafana) | УСЛОВНО | `GET /api/v1/health`, `GET /api/v1/ready`, `/metrics`; условие — заполнить прод-секреты и проверить алерты до открытия |
| Бэкапы перед миграциями (lock коды 0/3/1/2, timer, WAL-архив) | УСЛОВНО | условие — offsite-бакет (rclone) и пробный restore до боевых данных |

Открывающие условия Day-1 (операторское, не код): прод-`.env` без `change_me`
(прод-гард отклоняет), `REDIS_URL` задан (прод fail-fast), TLS в nginx, `CORS_ORIGINS`,
`AUTH_SECRET`/`JWT_SECRET` длиной ≥32, `REPL_PASSWORD` задан впрок (пригодится для Replica).

## 3. Что добавить вторым этапом (backlog с триггерами)

| # | Добавить | Триггер возврата | Риск откладывания |
|---|---|---|---|
| B1 | PostgreSQL Replica + чтение реестров через `DATABASE_REPLICA_URL` | RPS >20 sustained, чтения давят Primary, concurrent >50 | рост пилит Primary; чтение и запись конкурируют |
| B2 | 2-я реплика backend + балансировка nginx по DNS | backend CPU >70%, нужен деплой без даунтайма | рестарт = даунтайм; пик кладёт единственный инстанс |
| B3 | WAL-offsite + пробный restore + PITR-проверки | перед боевыми ПДн / перед ростом файлов | бэкап есть, восстановления не доказаны; RPO/RTO из прошлой спеки (5 мин/1 час) не подтверждены |
| B4 | Нагрузочные бенчмарки + гейты (методика спеки 2026-08-30) | перед маркетингом / перед заявкой на 10k | потолок пилота — расчётный, не замеренный |
| B5 | Второй узел/HA, разделение PG и MinIO по дискам/узлам | диск >80%, PG >100 ГБ, нужен SLO 99.9% | один узел = SPOF (зафиксировано прошлой спекой) |
| B6 | 152-ФЗ/закрытый контур, локальный LLM вместо внешнего | требование заказчика/контура | сейчас внешний LLM допустим только для пилота в облаке РФ |
| B7 | Полная отладка алертов (Telegram) под SLO | вместе с B5 | алерты есть, пороги под пилот не откалиброваны |

Не backlog: закупка железа до 1 млн ₽ и сценарий 10k/500 RPS — остаются в спеке
2026-08-30 как ветка роста, для пилота не покупаем. Китайская локаль — уже в продукте,
хинди — убран решением ранее.

## Трассировка (откуда взято, без новых замеров)

- Состав контура и лимиты: `technozrelost-backend/infra/docker-compose.prod.yml`
(backend cpus 1.0/memory 2G ×2, clamav 2.0/4G, сервисы db, db-replica, minio, clamav,
redis, backend, backup-timer, wal-offsite, alerter, frontend, nginx, prometheus, grafana).
- Методика CPU/RAM/диск/сеть/LLM и потолки 10k/500 RPS: `.autopilot/archive/runs/2026-08-30-server-infrastructure-requirements/spec.md`.
- Границы модулей и швы: `.autopilot/archive/runs/2026-09-08-audit-remediation/interfaces.md`
(auth/registry/realtime/files/ai/frontend-auth/landing/infra-backup/infra-observe/db).
- Роуты: `technozrelost-backend/app/main.py` (26 `include_router` под `/api/v1`).
- Обязательный Redis в проде, `REDIS_URL`, readiness 503: таск 01 прошлого прогона.
- SSE-ticket, лимиты реестров, кардинальность метрик, allowlist ролей, атомарный refresh,
лимит тела 32m, backup-lock, offline-очередь, изоляция LLM, витрина, эмбеддинги, P2/P3-пакеты:
таски 02–22 прошлого прогона.

Допущение сборки (одно): живых замеров RPS под пилотом нет — потолок посчитан по методике
прошлого расчёта и помечен как расчётный. Цены — только как диапазон аренды виртуалки
4vCPU/16GB/120GB в облаке РФ на дату отчёта («оценка, не оффер»): нижняя планка — тарифы
с посуточной оплатой, верхняя — управляемые диски/NVMe и запас до 8vCPU/24GB.
