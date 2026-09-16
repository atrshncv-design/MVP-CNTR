# Доказательная база, архитектура и расчёт ёмкости

## Статусы данных

- **Измерено:** результат воспроизводимого замера с непустыми метриками в артефакте.
- **Цель:** требование или порог приёмки, не гарантия достигнутой производительности.
- **Stale/stub:** историческая величина либо заглушка без результатов; годится только для планирования.
- **Допущение:** сценарная величина, которую необходимо заменить результатом benchmark или обследования площадки.

Входные цели: 10 000 одновременно вошедших пользователей, 300–500 HTTP RPS,
1 000 облачных LLM-запросов/час, 1 GiB новых файлов/день, основная двухсерверная
схема, бюджетное ожидание менее 1 млн руб., 99,9%, RPO 5 минут и RTO 1 час
(`.autopilot/2026-08-30-server-infrastructure-requirements--wip/interfaces.md:28-36`).

## 1. Назначение и профиль платформы

**Подтверждено проектом.** Это web-платформа Next.js/FastAPI: frontend фиксирует Next.js
16.3 и React 19.2 (`technozrelost-frontend/package.json:15-18`), backend — FastAPI 0.139.2,
SQLAlchemy 2.0.51, asyncpg 0.31.0 и pgvector 0.5.0
(`technozrelost-backend/pyproject.toml:17-24`). Нагрузочный harness отражает прикладной
профиль: 70% чтение реестров/карточек, 20% ЛК и оценка, 8% файлы, 2% очередь менеджера
(`technozrelost-backend/scripts/loadtest.py:4-11`).

**Обоснованно выведено.** Основные классы нагрузки: HTTP/API и SSR; транзакции и чтение
PostgreSQL; долгие SSE-соединения через Redis; object I/O и антивирусная проверка; RAG и
внешний LLM. Вес «одного пользователя» нельзя задавать фиксированной RAM-величиной:
capacity определяется RPS, числом открытых SSE/TLS-соединений, payload и mix операций.

**Неизвестно:** число зарегистрированных/DAU/MAU, DB cardinality, средний payload,
доля SSE, upload concurrency, размер RAG-контекста и внешний канал. Ниже это допущения.

Девять ролей: госкомпания-заказчик, R&D-исполнитель, научная организация, серийный
производитель, регулирующая организация, аудитор, инвестор, администратор ЦНТР и менеджер
ЦНТР (`technozrelost-frontend/src/lib/roles.ts:1-10`). Ключевые сценарии: регистрация/auth
и профиль; оценка УГТ; проекты, участники и приглашения; документы и антивирусная проверка;
заявка на повышение УГТ и менеджерская верификация; публичные реестры проектов, НИОКТР и
исполнителей; новости и достижения; notifications/SSE; AI/RAG. Фактический load mix для
реестров, оценки, файлов и manager queue подтверждён harness
(`technozrelost-backend/scripts/loadtest.py:57-81`).

## 2. Фактическая архитектура и поток запроса

Production Compose прямо описывает nginx, frontend, две FastAPI-реплики, PostgreSQL
Primary/Replica, MinIO, ClamAV и Redis (`technozrelost-backend/infra/docker-compose.prod.yml:1-3`).
Nginx направляет frontend на `frontend:3000`, API на `backend:8000`
(`technozrelost-backend/infra/nginx/nginx.prod.conf:73-74`,
`technozrelost-backend/infra/nginx/nginx.prod.conf:105-117`). Backend имеет две реплики,
лимит каждой 1 CPU/2 GiB (`technozrelost-backend/infra/docker-compose.prod.yml:184-203`).

Primary является единственной точкой записи, Replica — hot standby для безопасных чтений;
read-after-write остаётся на Primary (`technozrelost-backend/infra/docker-compose.prod.yml:10-16`).
Readiness проверяет реальные Primary и Replica (`technozrelost-backend/infra/docker-compose.prod.yml:274-283`).
Это логическая HA-заготовка, но все сервисы одного Compose на одном физическом host —
**обоснованный вывод и риск SPOF**: отказ host/площадки одновременно убирает обе БД и app.

Версии runtime: backend image использует Python 3.12
(`technozrelost-backend/Dockerfile:2-14`), PostgreSQL — pgvector 0.8.0 на PG16
(`technozrelost-backend/infra/docker-compose.prod.yml:23-26`,
`technozrelost-backend/infra/docker-compose.prod.yml:67-70`).

Способы развёртывания: dev Compose поднимает локальную инфраструктуру
(`technozrelost-backend/infra/README.md:12-15`); production запускается `deploy.sh` либо
прямым `docker compose ... up -d --build`
(`technozrelost-backend/infra/docker-compose.prod.yml:5-6`); `deploy.sh` поддерживает
health-gate и rollback (`technozrelost-backend/infra/deploy.sh:275-301`,
`technozrelost-backend/infra/deploy.sh:344-363`). Kubernetes/Helm и отдельный bare-metal
systemd deployment в canonical infra не найдены (**вывод по обследованным deployment-файлам;
требует уточнения**).

Внешние интеграции: OpenAI-compatible LLM с fallback
(`technozrelost-backend/app/services/ai_assistant.py:1-5`,
`technozrelost-backend/app/services/ai_assistant.py:32-44`); encrypted offsite через rclone
(`technozrelost-backend/infra/docker-compose.prod.yml:239-246`); Telegram alerts
(`technozrelost-backend/tests/test_infra_contracts.py:1358-1371`). Внутренние сетевые
зависимости: PostgreSQL, Redis, MinIO и ClamAV
(`technozrelost-backend/infra/docker-compose.prod.yml:206-230`). Отдельные task queue/broker,
OCR, speech, reranker, полнотекстовый search engine, local neural embeddings, local LLM и
Kubernetes не найдены (**вывод по canonical app/infra; проверить при появлении иных
контуров**). Их функции сейчас выполняют app scheduler, PostgreSQL/pgvector, CPU hashing и
внешний LLM; отдельные узлы им заранее не выделяются.

## 3. Данные, поиск и соединения БД

Вектор имеет 1536 измерений (`technozrelost-backend/app/core/config.py:46`). Текущий
embedding — детерминированный CPU hashing SHA-256 с нормализацией, не neural inference
(`technozrelost-backend/app/core/embeddings.py:16-30`). Поэтому **текущему контуру GPU не нужен**.

Каждая app-реплика имеет pool 10 и overflow 20; две реплики, DB max 100 и резерв 10
(`technozrelost-backend/app/core/config.py:35-45`). Worst-case верхняя граница только app:
`2 × (10 + 20) = 60` соединений; вместе с резервом `60 + 10 = 70 < 100`, остаётся 30.
Это конфигурационный предел, не измерение throughput. При росте первым шагом должен быть
benchmark pool wait/DB CPU/locks/replica lag; затем PgBouncer, что уже указано как путь роста
(`technozrelost-backend/app/core/config.py:35-39`).

## 4. Сервисы и профиль ресурсов

Полная матрица — **целевые допущения C**, не measured sizing. `IOPS` и `Seq` — минимальные
benchmark-пороги на сервис/узел, которые заменяются результатами p95 latency.

| Сервис | Частота / важность | Важность частоты CPU / frequency class | CPU phys. | RAM | VRAM | Storage / usable | IOPS | Seq | Bandwidth | Count | Размещение / scaling |
|---|---|---|---:|---:|---:|---|---:|---:|---:|---:|---|
| nginx | каждый HTTP/SSE; critical | medium; preferred ≥3.0 GHz | 1–2 | 1–2 GiB | 0 | logs 10 GiB | 500 | 50 MB/s | 2 Gbps public | 2 | one/node; stateless |
| Next.js | каждый page/SSR; high | high; required ≥3.0, preferred ≥3.5 GHz | 2–4 | 4–8 GiB | 0 | cache 20 GiB | 500 | 100 MB/s | 2 Gbps | 2 | replicas; CDN after measure |
| FastAPI | 300–500 RPS; critical | high; required ≥3.0, preferred ≥3.5 GHz | 12–19 total | 16–24 GiB | 0 | temp 40 GiB | 2k | 200 MB/s | 2–5 Gbps | 2+ | replicas; DB/scheduler limits |
| PG Primary | write/read-after-write; critical | high; required ≥3.0, preferred ≥3.5 GHz | 8–12 | 48–64 GiB | 0 | TLC+PLP mirror 4 TiB | 30k | 1 GB/s | 10GbE | 1 | vertical; single writer |
| PG Replica | reads + WAL continuous; critical | medium; required ≥2.8, preferred ≥3.2 GHz | 8–12 | 48–64 GiB | 0 | TLC+PLP mirror 4 TiB | 20k | 1 GB/s | 10GbE | 1 | read scale; controlled promotion |
| Redis/SSE | per event/connection; high | high; required ≥3.0, preferred ≥3.5 GHz | 2–4 | 4–8 GiB | 0 | AOF 50 GiB | 10k | 200 MB/s | 2–5 Gbps | 1 logical | replica/sentinel after benchmark |
| News scheduler | 1/60 s; medium | low; preferred ≥2.5 GHz | 0.5–1 | 0.5–1 GiB | 0 | DB-backed | 500 | 50 MB/s | <100 Mbps | 1 active | leader/lock before process scale |
| Workers/task queue | absent; conditional | N/A; service absent | 0 | 0 | 0 | none | 0 | 0 | 0 | 0 | add only for measured backlog |
| pgvector/RAG hash | query/ingest; high | high; required ≥3.0, preferred ≥3.5 GHz | 2–4 shared | 4–8 GiB | 0 | in PG 0.5–1 TiB | 20k | 1 GB/s | 10GbE | API+2 DB | index/partition/worker by benchmark |
| ClamAV | every upload; security critical | high; required ≥3.0, preferred ≥3.5 GHz | 2–4 | 4–8 GiB | 0 | sig/temp 20 GiB | 2k | 500 MB/s | 2–5 Gbps | 2 target | one/node; queue on measured burst |
| MinIO | every file; critical | medium; required ≥2.8, preferred ≥3.2 GHz | 2–4 | 4–8 GiB | 0 | 4 TiB/node | 10k | 1 GB/s | 10GbE | 2 target | explicit object replication |
| Prometheus/Grafana/logs | continuous/occasional; medium | low; preferred ≥2.5 GHz | 2–4 | 4–8 GiB | 0 | 200 GiB | 3k | 300 MB/s | 1 Gbps | 1 each | retention/shard after measure |
| Backup/WAL offsite | daily + continuous/≤60 s target; DR critical | medium; preferred ≥2.8 GHz | 2–4 | 2–4 GiB | 0 | external ≈10 TiB | 2k | 500 MB/s | 1–10GbE | 1 each | offsite; window/restore govern |
| Alerter | each probe interval; high ops | low; preferred ≥2.0 GHz | 0.5 | 0.5 GiB | 0 | <1 GiB | 100 | 10 MB/s | <100 Mbps | 1 | external notification path |
| CI/staging | per change/release; non-runtime | medium; preferred ≥3.0 GHz | 8 | 16 GiB | 0 | 200 GiB | 2k | 500 MB/s | 1 Gbps | 1/env | outside production |

RAM — ECC, рекомендуемо 3200 MT/s или быстрее при совместимости платформы; storage — enterprise TLC
SSD/NVMe с PLP. Требуемые IOPS/throughput остаются неизвестны до `fio` и DB benchmark.
Текущий Compose уже включает MinIO endpoint, Redis и ClamAV
(`technozrelost-backend/infra/docker-compose.prod.yml:222-230`), но resource limits кроме API
не доказывают достаточность остальных сервисов.

## 5. CPU-модель

**Historical evidence, stale:** локальный старый прогон зафиксировал plateau 55–61 RPS при
150–200 пользователях, backend ≈89% одного ядра и DB <15%
(`.autopilot/2026-08-25-deploy-readiness-audit/tickets/report-06.md:49-50`). Нормировочный
baseline: `60 / 0,89 = 67,42 RPS/core`. Он не является текущим измерением: актуальный
load-test артефакт имеет статус `stub` и пустой throughput
(`reports/loadtest_report.json:3-10`).

Формула API: `CPU_api = RPS × (0,89 / 60) × K`, где K = 1,5–2,5.

| RPS | K | Расчёт | API physical-core equivalent |
|---:|---:|---:|---:|
| 300 | 1,5 | 300×0,014833×1,5 | 6,68 |
| 300 | 2,5 | 300×0,014833×2,5 | 11,13 |
| 500 | 1,5 | 500×0,014833×1,5 | 11,13 |
| 500 | 2,5 | 500×0,014833×2,5 | 18,54 |

Для normal two-node C закладывается 12–16 API-ядер суммарно; для истинного single-node
failover при 500 RPS требуется проверить 19 физических ядер только API, плюс DB и сервисы.
Следовательно, две машины по 24–32 физических ядра дают проверяемый, но не гарантированный
failover headroom. SMT-потоки не считаются физическими ядрами. Частота: целевой высокий
single-core turbo ≥3,5 GHz, но конкретный IPC/частота проверяются на выбранном CPU.

## 6. RAM-модель

Формула: `RAM_required = sum(working sets) / utilization_limit`; limit = 0,70–0,75.
**Допущение C на узел:** PG 32 + API 8 + MinIO 4 + ClamAV 4 + Redis 4 + frontend/nginx 3
+ monitoring 4 + OS 4 = 63 GiB working set. При 75%: `63 / 0,75 = 84 GiB`; при 70%:
`63 / 0,70 = 90 GiB`. Практический класс — 96 GiB минимум, 128 GiB рекомендуется.

**Degraded/failover допущение:** API 16 + PG 48 + остальные 23 = 87 GiB; `87 / 0,70 =
124,3 GiB`, поэтому 128 GiB — нижняя граница, без большого page-cache запаса. Production-like
замер RSS, PostgreSQL cache hit/temp spill и ClamAV peak обязан подтвердить 128 GiB.
VRAM текущего варианта = 0.

## 7. Хранилище и I/O

Формула файлов: `1 GiB/day × 365 × years × 1,30 / 0,80`.

| Горизонт | Расчёт | Требуемый usable budget файлов |
|---:|---:|---:|
| 1 год | 365×1,30/0,80 | 593 GiB |
| 3 года | 1095×1,30/0,80 | 1 779 GiB = 1,74 TiB |

**Допущение D:** плюс DB/index/WAL 1 TiB, monitoring/log/temp 0,5 TiB даёт около 3,24 TiB
usable operational data; округление до 4 TiB usable на узел оставляет пересчитываемый запас.
Для зеркала raw вдвое больше usable: 4 TiB usable RAID1 требует ≥8 TiB raw на узел.
RAID защищает только от диска и не является backup.

Класс: enterprise TLC NVMe/SSD с PLP; Primary/Replica — отдельные зеркала. **Неизвестно:**
DB growth, write amplification, IOPS, sequential throughput, retention логов и compression.
До закупки: `fio` безопасным профилем и PostgreSQL benchmark на кандидатном RAID, включая
fsync latency, p95/p99 и rebuild impact.

## 8. Сеть

Формула public egress: `Mbps = RPS × payload_KiB × 8 / 1024`.

| RPS | 50 KiB | 100 KiB | 250 KiB |
|---:|---:|---:|---:|
| 300 | 117,19 Mbps | 234,38 Mbps | 585,94 Mbps |
| 500 | 195,31 Mbps | 390,63 Mbps | 976,56 Mbps |

С protocol/TLS/retry headroom 30% верхняя точка: `976,56×1,3 = 1 269,53 Mbps`.
**Цель:** внешний симметричный канал ≥2 Gbps для 500 RPS/250 KiB, если payload подтвердится;
иначе пересчитать. Межузловая сеть — redundant 10GbE для WAL, object replication, backup,
ClamAV и failover. 25GbE не покупать без измерения saturation/backup window.

## 9. Сценарии A–D

Все cardinality, кроме заданных concurrency/RPS/LLM/file growth, — **допущения**.

| Поле | A MVP | B пилот | C production | D рост 2–3 года | Источник / формула |
|---|---|---|---|---|---|
| Registered / DAU / MAU | 2k/300/1k | 20k/3k/10k | 100k/20k/60k | 300k/60k/180k | assumption; заменить analytics |
| Concurrent | 200 | 2 000 | 10 000 | 20 000 | A/B/D assumption; C target (`.autopilot/2026-08-30-server-infrastructure-requirements--wip/interfaces.md:30`) |
| HTTP RPS | 30–60 | ≤300 | 300–500 | 600–1 000 | A/B/D assumption; C target (`.autopilot/2026-08-30-server-infrastructure-requirements--wip/interfaces.md:31`) |
| Background | scheduler 1/min; backup daily | uploads 5/min; LLM 100/h | uploads 20/min; LLM 1 000/h; fan-out/RAG | uploads 50/min; LLM 3 000/h; conditional neural ingest | scheduler source below; other rates assumption; C LLM target (`.autopilot/2026-08-30-server-infrastructure-requirements--wip/interfaces.md:32`) |
| DB volume | ≤100 GiB | ≤300 GiB | ≤1 TiB | 1–3 TiB | assumption; replace DB cardinality/bytes |
| File growth/day | 1 GiB | 1 GiB | 1 GiB | 1–3 GiB | A–C target (`.autopilot/2026-08-30-server-infrastructure-requirements--wip/interfaces.md:33`); D assumption |
| Monthly data growth | 30 GiB + DB unknown | 30 GiB + DB unknown | 30 GiB + DB unknown | 30–90 GiB + DB unknown | `file/day×30`; DB change not measured |
| Avg network payload | 50 KiB | 100 KiB | 50–250 KiB | 250 KiB | assumption; replace access-log bytes |
| Monthly network traffic | 7.24 TiB | 72.42 TiB | 36.21–301.75 TiB | 603.50 TiB | `RPS×KiB×2,592,000/1,073,741,824`; upper RPS, sustained 30d assumption |
| Latency target | read 500ms/write 1s | same | same | same after scale-out | harness target (`technozrelost-backend/scripts/loadtest.py:10-11`) |
| Resource limit | 16c/64GiB/2TiB | 2×16c/96GiB/4TiB | 2×24–32c/128GiB/4TiB | 3 nodes/service split; 128–256GiB/node | sizing assumption from §§5–8 |
| Headroom | K=1.5 | K=1.5–2 | K=2–2.5 | K=2.5 + scale-out | explicit CPU planning assumption |

Фактический scheduler запускается раз в 60 секунд
(`technozrelost-backend/app/services/news_scheduler.py:3-17`). Backup/WAL частоты должны
измеряться по runtime markers, а не только предполагаться. Сценарий C normal распределяет
API и DB роли по двум узлам; degraded переносит все роли на один и допускает временное
снижение throughput, пока benchmark не докажет 500 RPS на одном узле.

## 10. AI и LLM

`1 000/hour / 3 600 = 0,2778 RPS`. По Little's Law concurrency `λ×latency`:
5/10/30/60 секунд дают 1,39/2,78/8,33/16,67 запросов. Целевой semaphore 20–25 покрывает
60 секунд с 20–50% запасом. Backend настроен на OpenAI-compatible API и по умолчанию
gateway выключен (`technozrelost-backend/app/core/config.py:60-68`); это также означает,
что доступность внешнего AI не равна доступности основной платформы.

| Вариант | Ресурс | Статус |
|---|---|---|
| 1. API LLM + hashing embeddings | CPU выше; VRAM 0 | текущая рекомендация |
| 2. API LLM + local embeddings/OCR/reranker | условно 16–24 GiB VRAM, PCIe x16, 300–450 W | ветка развития после выбора моделей/benchmark |
| 3. Local LLM | условно 48–96+ GiB aggregate VRAM, INT4/INT8; multi-GPU/800–1600 W | не закупать без модели, tokens/s, concurrent sequences и TCO |

FP16/BF16 обычно удваивает память весов относительно INT8 и примерно учетверяет против
INT4, но KV-cache/context/concurrency добавляются отдельно. **Неизвестны:** model context
window, max_tokens, RAG context, тариф токенов и latency. Break-even:
`months = GPU_CAPEX / (cloud_token_cost_month − electricity_month − support_month)`;
если знаменатель ≤0, локальный вариант экономически не окупается.

## 11. Варианты размещения

Оценка 1 (лучше)–5 (хуже); значения — **архитектурная оценка**, не benchmark.

| Категория (ровно 6) | Подвариант | Perf | CAPEX | OPEX | Reliability | Scale | Maintenance | Security | Redundancy | Recovery | SPOF |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1. Один физический сервер | один host | 3 | 2 | 2 | 5 | 5 | 2 | 3 | 5 | 5 | host/site |
| 2. Несколько серверов с разделением ролей | два сервера | 2 | 3 | 2 | 2 | 3 | 3 | 2 | 2 | 2 | site; witness/offsite remain |
| 2. Несколько серверов с разделением ролей | три сервера | 1 | 4 | 3 | 1 | 2 | 4 | 2 | 1 | 1 | site unless geo |
| 3. Dedicated hosting | dedicated | 2 | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 2 | provider/site |
| 4. Cloud | cloud | 2 | 1 | 5 | 2 | 1 | 3 | 4 | 1 | 1 | provider/account |
| 5. Hybrid | hybrid | 2 | 4 | 4 | 2 | 2 | 5 | 3 | 2 | 2 | WAN/integration |
| 6. Separate AI host | AI host | 1 for AI | 5 | 4 | 3 | 2 | 4 | 2 | 4 | 4 | AI host |

Рекомендация C (**assumption/topology target**): узел 1 — Primary + половина stateless;
узел 2 — Replica + половина stateless; object data явно реплицировать, backup держать вне
обоих. Основание для Primary/Replica и stateless replicas:
`technozrelost-backend/infra/docker-compose.prod.yml:10-16` и
`technozrelost-backend/infra/docker-compose.prod.yml:184-203`. Ручной promotion либо внешний
witness при двух voting nodes — **architecture assumption для исключения split-brain**.
Один сервер допустим только для A (**assumption**); третий улучшает quorum/maintenance,
но нужен только после benchmark (**assumption**).

## 12. HA, backup и DR

Критичны PostgreSQL, MinIO, секреты и конфигурация. Compose хранит Primary data и WAL archive
в отдельных volumes (`technozrelost-backend/infra/docker-compose.prod.yml:42-50`), имеет
ежедневный backup sidecar (`technozrelost-backend/infra/docker-compose.prod.yml:289-299`) и
настраивает offsite marker/rclone (`technozrelost-backend/infra/docker-compose.prod.yml:239-246`).
Наличие механизмов не доказывает успешное внешнее копирование или restore.

**Целевой план:** nightly full/base; continuous WAL archive с `archive_timeout ≤60s`;
offsite sync ≤5 минут; 14 daily + 8 weekly + 12 monthly logical/object copies; quarterly
полный restore drill и ежемесячный выборочный restore. 3-2-1: production copy + локальная
backup-копия на другом media + encrypted offsite copy вне обоих узлов.

При operational data 3,24 TiB, full-copy raw budget без compression:
`14×3,24 = 45,36 TiB` слишком велик; с инкрементами формула
`3,24×N_full + daily_change×days + WAL`, затем `/0,8` для 20% free. **Допущение:** 2 weekly
full + 28 daily changes по 1% + WAL 0,5 TiB: `6,48 + 0,907 + 0,5 = 7,887 TiB`;
`7,887/0,8 = 9,86 TiB`, поэтому внешний класс 10 TiB минимум, но change/compression/WAL
обязательно измерить.

99,9% допускает `30×24×60×0,001 = 43,2 min` за 30-дневный месяц (43,8 min при среднем
месяце 30,4167 дня). RTO 1 час уже превышает месячный downtime budget, поэтому это DR ceiling,
не гарантия 99,9%. Routine failover должен целиться в 5–15 минут; RPO 5 минут требует
подтверждённых WAL/offsite markers и restore drill. RAID, dual PSU и VM не заменяют второй
узел или offsite backup.

## 13. Риски и узкие места

| Риск | Статус | Проверка/снижение |
|---|---|---|
| Single-host Compose/SPOF | выведено | физически разнести два узла и offsite |
| API baseline неактуален | stale | 300/500 RPS benchmark |
| 10K SSE/TLS не измерены | неизвестно | connections, fd, Redis memory/network test |
| Primary write bottleneck | выведено | DB CPU/locks/IOPS/pool wait |
| Replica lag/read staleness | неизвестно | lag under write/file load and failover |
| MinIO replication не доказана | неизвестно | node/site loss and object restore |
| ClamAV upload burst | неизвестно | 25 MiB files, concurrency and scan p95 |
| Scheduler внутри app replicas | подтверждено частотой | prove singleton/lock and failover |
| External LLM latency/outage/data policy | условно | timeout, semaphore, fallback, DPA |
| Budget <1m vs HA/enterprise storage | цель | BOM/КП; рассмотреть refurbished отдельно |

## 14. Benchmark и пересчёт

Текущий harness задаёт 1 000 VU, 120 секунд и цели success ≥99%, p95 read ≤500 ms,
write ≤1 s (`technozrelost-backend/scripts/loadtest.py:13-22`,
`technozrelost-backend/scripts/loadtest.py:41-42`), но текущий отчёт содержит нули/null и
`all_targets_pass: null` (`reports/loadtest_report.json:26-39`). Это **stub, не PASS**.

В этой работе не запускались nginx, Next.js, FastAPI, Primary, Replica, Redis, MinIO,
ClamAV, scheduler, Prometheus, Grafana, backup-timer, WAL-offsite и alerter: ticket запрещает
опасный/длительный load test, а сохранённый артефакт прямо сообщает, что локальный прогон не
выполнялся из-за отсутствия host 4 vCPU/12 GB (`reports/loadtest_report.json:3-5`). Поэтому
не измерены полный idle profile, per-service CPU/RSS, API/file/background profile, IOPS,
sequential throughput, SSE memory, replica lag, object replication и backup window. Это
экспериментальный пробел, а не нулевое потребление.

До закупки на production-like кандидатах безопасно и согласованно выполнить ступени 300 и
500 RPS с реальным mix 70/20/8/2; отдельно 10 000 SSE/TLS; payload 50/100/250 KiB; LLM
latency/failure injection; upload+ClamAV; replica lag; one-node failure; backup и полный
restore. Собирать CPU per service, RSS/page cache, DB pool wait/locks/temp/IOPS, disk latency,
network/WAL, p50/p95/p99 и errors. Длительный/опасный тест в этой работе не выполнялся.

Пересчёт после замера:

1. `core_cost = measured_CPU_cores / measured_RPS`; `CPU_api = target_RPS × core_cost × K`.
2. `RAM = measured_peak_working_sets / 0,70`; повторить для one-node failover.
3. `storage = measured_daily_change × retention + full copies + WAL`, затем `/0,8`.
4. `network = measured_bytes/RPS × target_RPS × 8`, затем +30% headroom.
5. Принять конфигурацию только при success ≥99%, latency targets, lag/RPO и failover/RTO.

## 15. Вывод, неизвестные и границы гарантии

Для C рабочая **гипотеза**, а не гарантия: два физических узла по 24–32 физических ядра,
128 GiB ECC, 4 TiB usable enterprise TLC+PLP mirror, redundant 10GbE; внешний backup около
10 TiB и внешний witness. GPU сейчас не нужен. A может жить на одном узле; D требует третьего
узла либо выделения DB/object/worker по фактическому bottleneck, а не заранее.

Не определены new/refurbished, точные cardinality/payload, поставщик/наличие, площадка и канал.
Нужно посчитать обе закупочные ветки и получить КП; цена без публичного предложения — оценка.
Показатели 300–500 RPS, 10K concurrency, 99,9%, RPO 5 минут и RTO 1 час остаются **целями**
до benchmark/failover/restore. Изменение приложения, deployment и инфраструктурных конфигов,
закупка, deploy и опасный load test не входят в эту работу.
