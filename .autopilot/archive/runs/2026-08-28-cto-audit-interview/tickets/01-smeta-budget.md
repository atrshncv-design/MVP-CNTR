# Тикет 01 — Смета бюджета ЦНТР (передать сметчику)

**Источник:** Большое интервью 280826 Q11-Q13, brief.md:Q11, файл `Большое интервью 280826/09-смета-бюджет-и-локальная-LLM.md` — неверен, пересчитать.

## Задача
Составить максимально подробную смету для бюджета ЦНТР на инфраструктуру платформы Технозрелость под пики 5К и 10К одновременных пользователей (профиль 65% чтение реестров /15% запись документов /15% Туно RAG /<1% админы, `GMT+4` 8-18 пик, проект 5-20 человек, `think-time` 7с → 714 RPS на 5К, 1428 RPS на 10К, LLM 500 vs 1000 conc).

## Параметры, которые ОБЯЗАНЫ быть в смете (чек-лист)
- [ ] **Хост/контейнер разбивка:** `nginx:443` (TLS, rate-limit, cache `_next/static` `nginx.prod.conf:1`), `frontend` Next.js SSR `next.config.ts:1` (кол-во реплик), `backend` FastAPI `app/main.py` (реплики, `deploy.replicas` `compose.prod.yml`), `PostgreSQL Primary:5432` ( `max_connections=100` `postgresql-primary.conf:12`, `shared_buffers`, `wal-archive-prod-data` `compose.prod.yml:39`, `archive_timeout=60s` `postgresql-pitr.conf:13`), `PostgreSQL Replica:5433` (`get_read_db()` `database.py:21`), `pgbouncer` (транзакционный), `Redis` (`throttle` `P-04` + кэш `P-09`), `MinIO:9000` (`max_file_size_mb=25` `config.py:70`, `file_storage.py:245`), `ClamAV:3310` fail-closed, `WAL-offsite` + `backup-timer` (`BACKUP_AT`, `BACKUP_KEEP`, `BACKUP_OFFSITE_REMOTE` `type=crypt` `backup.sh:322`).
- [ ] **CPU/RAM/disk на каждый контейнер:** указать vCPU, RAM ГБ, NVMe ГБ (отдельно WAL-archive, backups-prod-data 2Тб). Обосновать весом 1 пользователя: читатель 0.02 CPU/5МБ, писатель 0.08/50МБ+1с ClamAV, Туно 30МБ×3с (1000 vs 500 conc).
- [ ] **Два сценария:** пилот `500 VU` (презентация главе ноябрь, 1 хост 8/32) и цель `5К` (2 хоста ~84 ГБ) + `10К` (3 хоста ~166 ГБ `06-сервер-10К.md`). Показать дельту.
- [ ] **RPO/RTO:** `RPO≤5м` (WAL 60с), `RTO≤1ч` (`rehearse_pitr.sh` PASS), `99.9%` (8ч44м/год) — как достигается `alerter.py:32` Telegram + `health-gate` `deploy.sh:60`.
- [ ] **LLM:** облако `LLM_API_BASE` `config.py:57` 500/1000 запр/день ×$0.02, и опция локальная PII-чистка `Mistral 7B Q4` 1×A100 40ГБ (500 обезличиваний) vs полная 1000 conc (нереально 50-100×A100). Указать `LLM_GATEWAY_ENABLED` + `contour tuno/kaba` `rag_documents` `0028`.
- [ ] **Сеть:** порты 80/443, исходящий HTTPS, `CORS_ORIGINS`, `NEXTAUTH_URL`.
- [ ] **152-ФЗ:** шифрование at-rest (`type=crypt` offsite), `scan_status fail-closed` `files.py:139`, `visibility open/closed` RLS.
- [ ] **Итог:** таблица `мес`/`год` в ₽ (РФ 2026), пилот vs 5К vs 10К, разовая настройка.

## Приёмка
- [ ] Смета в `docs/СЕРВЕР-ТРЕБОВАНИЯ.md` + `Большое интервью 280826/09-смета-*.md` v2, каждая строка с «почему».
- [ ] `ruff`/`mypy` не требуется, но цифры сверены с `06-сервер-10К.md` и `P-01` guard `tests/test_db_pool.py`.
- [ ] Пересчёт 5К: 714 RPS, 500 conc LLM → 4 backend×3ГБ=12, 2 frontend×4=8, PG 32+16, Redis 4, MinIO 12+4 → ~84 ГБ 2 хоста.

## Связи
- `G01` 10К→5К, `R07` техкарта, `INF-01..07` надёжность, `N-05` LLM.

