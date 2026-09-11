# Evidence 08: производительность и устойчивость

## Область и метод

- Baseline: `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`, отдельный worktree, 2026-09-10. До этой записи worktree уже содержал изменения/новые файлы `.autopilot/**`; продуктовый код не изменялся.
- Проверка read-only: статическая трассировка backend/frontend/DB/Redis/MinIO/ClamAV/LLM/nginx/Compose. Docker, сервисы, БД, внешние вызовы и destructive load не запускались.
- **Измерено:** только состав и параметры текущего checkout. **Не измерено:** RPS, p50/p95/p99, RSS, CPU, pool wait, число файловых дескрипторов, Redis clients/memory, DB execution plans/locks, replica lag и graceful-drain time. Числа capacity ниже являются расчётами, не заявлением достигнутой производительности.

## Статическая capacity-модель

Исходные параметры: 2 backend replicas по 1 uvicorn worker и 1 CPU/2 GiB (`technozrelost-backend/infra/docker-compose.prod.yml:186-205`, `technozrelost-backend/infra/backend-entrypoint.sh:134-135`); на процесс отдельные Primary и Replica pools по `10 + 20 overflow`, без заданного `pool_timeout` (`technozrelost-backend/app/core/config.py:35-45`, `technozrelost-backend/app/core/database.py:21-39`); каждый DB server имеет `max_connections=100` (`technozrelost-backend/infra/postgres/postgresql-primary.conf:18-21`). Поэтому production даёт до 60 checked-out app connections к Primary и отдельно до 60 к Replica, оставляя 40 на каждом DB server для служебных клиентов. Это не 60 RPS: throughput зависит от времени удержания соединения. AI ограничен 4 вызовами/процесс, итого 8; ожидание семафора 2 с, upstream timeout 8 с (`technozrelost-backend/app/services/ai_assistant.py:21-28,69-111`).

| Concurrent clients | Первый расчётный предел | Что это означает | Обязательный безопасный стендовый замер |
|---:|---|---|---|
| 100 | DB: 60 одновременных операций на каждом DB-узле; upload RAM/event-loop | При синхронном DB-heavy burst минимум 40 запросов ждут pool; 100 максимальных upload дают минимум 5,000 MiB временных chunk+joined buffers суммарно, без multipart/spool/runtime | mixed 70/20/10 read/write/upload; pool checkout wait, RSS/event-loop lag, DB active/queued, p95/p99 |
| 500 | 2 CPU backend, DB queues, AI `8 running / 492 wait-or-fallback` | Без ограничения admission 440 DB-heavy операций могут ждать; AI overflow возвращает fallback примерно после 2 с, а не ставится в durable queue | ступени 100→500, saturation CPU, pool timeout/cancel, fallback ratio, Redis clients |
| 1,000 | single frontend и nginx, Redis/SSE client cardinality, FD limits не заданы | Capacity не сертифицируема: frontend/nginx не реплицированы и repo не задаёт `worker_connections`/`nofile`; один SSE создаёт отдельный Redis client/pool | 1k idle+eventing SSE, reconnect wave, open FDs, Redis `connected_clients`, frontend RSS/ELU |
| 5,000 | SSE Redis-pool leak; unbounded feeds/fan-out; инфраструктурные SPOF | 5k SSE означают 5k generators/pubsubs и до 5k незакрытых client pools; один Redis/MinIO/Primary/Replica/frontend/nginx остаётся failure domain | soak 5k с churn, heap/RSS slope, FD slope, Redis memory/pubsub, scheduler duration/outbox growth |
| 10,000 | топология и лимиты ресурсов не имеют доказанного запаса | DB остаётся 60 concurrent operations per node, AI 8 calls, backend 2 CPU; максимальные file/notification bursts превосходят память/transaction budget на порядки | отдельный production-like стенд, distributed load, 10k SSE + mixed API, failover/drain, EXPLAIN ANALYZE на объёмных данных |

Расчёт file memory использует нижнюю границу: `read_upload_limited` сохраняет список chunks до 25 MiB и затем `b"".join(chunks)` создаёт ещё один bytes до 25 MiB (`technozrelost-backend/app/services/file_storage.py:443-464`). Реальный peak выше из-за `UploadFile`, ASGI/multipart, request objects и ClamAV/MinIO buffers. Для chunked запросов без `Content-Length` middleware дополнительно буферизует до 32 MiB и создаёт bytes-копию при replay (`technozrelost-backend/app/main.py:105-111,146-171`).

## Кандидаты находок

### P08-01 — File paths блокируют единственный event loop, держат целые объекты в RAM и не имеют end-to-end timeout

- Category: performance/resilience; proposed severity **High**; confidence **Confirmed**.
- Evidence: оба upload route читают файл целиком, затем вызывают синхронный `store_project_file` прямо из async handler (`technozrelost-backend/app/api/v1/files.py:70-105`, `technozrelost-backend/app/api/v1/stages.py:390-431`), хотя готов async wrapper существует (`technozrelost-backend/app/services/file_storage.py:376-393`). MinIO `put_object` синхронен (`technozrelost-backend/app/services/file_storage.py:246-258`). ClamAV connect, `drain` и read не обёрнуты timeout (`technozrelost-backend/app/services/file_storage.py:184-212`). Downloads читают объект целиком и возвращают bytes (`technozrelost-backend/app/services/file_storage.py:264-275`, `technozrelost-backend/app/api/v1/files.py:128-163`). DB dependency живёт весь request (`technozrelost-backend/app/core/database.py:51-54`).
- Safe scenario: статически проследить `POST /projects/{id}/files` при медленном MinIO/ClamAV: после DB access file остаётся в RAM, sync put останавливает worker event loop, scan может ждать бессрочно; параллельные API/SSE keepalive этого worker не получают исполнения. Несколько 25-MiB операций пересекают 2-GiB container limit; download имеет тот же O(concurrency × file_size) RSS.
- Impact: process-wide latency spike, OOM/restart, удержание DB session и потеря доступности половины backend при одном медленном dependency.
- Remediation: streaming multipart→quarantine object→ClamAV with bounded spool, `StreamingResponse` для download; использовать async/thread wrapper с отдельным bounded executor/semaphore; connect/write/read/overall timeouts; освобождать DB transaction до file I/O.
- Tests: async concurrency contract с искусственно медленным storage и быстрым `/health`; boundary RSS/timeout test на 25 MiB; streaming download test. Dependencies: storage quarantine lifecycle.

### P08-02 — Realtime создаёт Redis client/pool на каждый вызов и не закрывает client SSE

- Category: Redis/SSE/leak; proposed severity **High**; confidence **Confirmed**.
- Evidence: `_get_redis_async()` каждый раз вызывает `redis_async.from_url` (`technozrelost-backend/app/api/v1/realtime.py:102-113`); его вызывают ticket store/consume, publish и каждый stream (`technozrelost-backend/app/api/v1/realtime.py:59-87,116-132,198-203`). Завершение stream закрывает только pubsub, но не `rclient` (`technozrelost-backend/app/api/v1/realtime.py:234-239`); lifecycle закрытия Redis clients отсутствует, lifespan отменяет только scheduler (`technozrelost-backend/app/main.py:92-102`). Комментарий «from_url кэширует пул» (`realtime.py:129`) не реализует общий объект в коде.
- Safe scenario: каждый connect/reconnect выпускает ticket (два ephemeral clients) и stream client; закрытие 10k последовательных/конкурентных streams не вызывает `rclient.aclose()`. Число pools/sockets/resources может расти до GC, а 10k active streams требуют минимум 10k pubsub subscriptions.
- Impact: Redis connection/FD exhaustion и RSS slope; realtime деградирует независимо на двух процессах. При Redis error код молча переходит в per-process fallback, где ticket, выпущенный репликой A, не потребляется B (`realtime.py:39-46,65-95`), а события другой реплики теряются (`realtime.py:133-139`). Readiness позже удалит реплики, но race деградации остаётся.
- Remediation: один lifecycle-managed async Redis client/pool на process, явный `aclose` при shutdown, bounded pool/connection metrics; при configured Redis fail closed для ticket consume/publish вместо локального split-brain.
- Tests: fake client считает `from_url/aclose`; two-replica Redis-loss contract; 10k connect/disconnect soak с FD/RSS assertion. Dependencies: shared Redis availability policy.

### P08-03 — Scheduler создаёт неограниченный multiplicative fan-out в одной транзакции

- Category: scheduler/DB/queue; proposed severity **High**; confidence **Confirmed**.
- Evidence: один tick обновляет и `fetchall()` все due posts без limit (`technozrelost-backend/app/services/news_scheduler.py:20-47`), затем для каждого post вызывает broadcast (`news_scheduler.py:47-51`). Broadcast загружает все active user IDs (`technozrelost-backend/app/services/notifications.py:105-121`) и для каждого пользователя создаёт Notification и Outbox; flush идёт батчами, но commit только после обработки всех постов (`notifications.py:121-154`, `news_scheduler.py:51`). Scheduler всё это время держит session-level advisory lock и pool connection (`technozrelost-backend/app/main.py:67-89`).
- Safe scenario: 100 одновременно due posts и 10k active users создают расчётно 1,000,000 notifications + 1,000,000 outbox ORM rows в одной transaction/tick. `user_ids` перечитываются 100 раз; rollback отменит весь fan-out при последней ошибке.
- Impact: долгий lock/transaction, WAL/replica-lag burst, ORM memory/CPU, пропуск последующих ticks и давление на Primary.
- Remediation: claim due posts ограниченными batches с durable state/idempotency, bulk SQL insert, commit per post/batch, broadcast job queue и backpressure; метрики oldest due/processing duration/failures.
- Tests: 100 posts × synthetic 10k users с bounded batch/transaction assertions; interruption/resume idempotency; two-replica leadership. Dependencies: queue semantics and retention.

### P08-04 — Критические списки остаются unbounded; manager draft queue содержит N+1

- Category: DB/query shape/payload; proposed severity **High**; confidence **Confirmed**.
- Evidence: personal projects выбираются все, затем все control points и counts (`technozrelost-backend/app/api/v1/projects.py:198-225`); project detail без лимитов загружает documents, verification docs, members и append-only audit (`projects.py:505-607`), а staff `?all=1` также все questionnaire rows (`projects.py:526-533`). Notification feed выбирает всю историю (`technozrelost-backend/app/api/v1/notifications.py:27-40`) и frontend повторяет её каждые 30 с даже при живом SSE (`technozrelost-frontend/src/features/notifications/useNotifications.ts:40-49`). Manager draft queue выбирает все drafts и затем отдельным query получает questionnaire rows каждого проекта (`technozrelost-backend/app/api/v1/manager.py:69-112`). Project file list также без pagination (`technozrelost-backend/app/api/v1/files.py:113-125`).
- Safe scenario: U user-owned projects produce three growing result sets; D drafts produce `1 + D` queries; a user with N notifications transfers/serializes N rows every 30 s. At 10k clients polling, baseline is 333 feed requests/s before SSE event-triggered reloads, each O(user history).
- Impact: DB CPU/I/O and response/RSS grow with retained history rather than page size; one heavy tenant affects both replicas because authenticated personal endpoints use Primary.
- Remediation: keyset pagination and hard max page sizes; separate bounded summaries/details; batch draft questionnaire query; notification retention/archive and `after_id`/unread count endpoint; stop unconditional polling while SSE is open.
- Tests: query-count assertion independent of D; page-boundary tests at 10k rows; payload-size and keyset stability tests. Dependencies: frontend pagination contracts.

### P08-05 — Prometheus scrape перечисляет весь MinIO bucket каждые 15 секунд и I/O не ограничен timeout

- Category: observability/self-load; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: каждый `/metrics` параллельно вызывает `storage.object_count` (`technozrelost-backend/app/api/v1/metrics.py:78-96`), который полностью перебирает recursive `list_objects` (`technozrelost-backend/app/services/file_storage.py:297-305`). Prometheus скрапит обе backend replicas каждые 15 с (`technozrelost-backend/infra/prometheus/prometheus.yml:11-22`), то есть bucket listing выполняется дважды за интервал. Timeout вокруг `to_thread` отсутствует.
- Safe scenario: при M objects monitoring делает O(2M/15s) listing work; зависший SDK call остаётся worker thread. Последующие scrapes создают новые pending calls, и мониторинг усиливает MinIO outage.
- Impact: растущая стоимость scrape, threadpool starvation, отсутствующие метрики во время инцидента.
- Remediation: хранить object count как DB/counter metric или обновлять отдельным медленным cached collector; bounded timeout и stale/unknown indicator; не дублировать global gauge per replica.
- Tests: object_count вызывается не чаще cache TTL; timeout returns bounded response; scrape cost не зависит от M. Dependencies: metric ownership.

### P08-06 — Readiness связывает запуск всего edge-стека со всеми зависимостями и сама может зависнуть

- Category: failure domains/readiness; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: readiness последовательно проверяет DBs, Redis, storage, ClamAV (`technozrelost-backend/app/api/v1/health.py:86-107`); любая недоступная Replica/Redis/MinIO/ClamAV даёт 503 (`health.py:99-106`). Storage health вызывает MinIO SDK без application timeout (`health.py:41-54`, `file_storage.py:288-295`). Compose healthcheck имеет внешний timeout 5 с и после retries помечает backend unhealthy, а frontend и nginx при старте ожидают healthy backend (`technozrelost-backend/infra/docker-compose.prod.yml:250-286,468-503`). Compose не выполняет runtime-эвикцию unhealthy backend из nginx: это отдельный остаточный риск, а не заявленная защита.
- Safe scenario: отказ ClamAV или Replica, хотя core Primary CRUD исправен, делает обе backend replicas not-ready и блокирует чистый старт/recovery frontend и nginx через `depends_on`. В уже запущенном Compose edge продолжает маршрутизировать на unhealthy backend. Медленный MinIO может занимать probe thread дольше внешнего timeout; повтор probes не отменяет underlying sync I/O.
- Impact: локальный file/read dependency outage блокирует развёртывание/восстановление всего edge-стека, а runtime readiness не управляет трафиком; готовность не различает обязательные и деградируемые функции.
- Remediation: параллельные bounded probes; readiness только для зависимостей, без которых instance не может обслуживать основной контракт; component health/feature gates для file/AI/replica, fallback reads policy; orchestrator-level routing вместо startup-only `depends_on`.
- Tests: fault matrix Primary/Replica/Redis/MinIO/ClamAV с ожидаемыми доступными маршрутами; hung dependency probe completes before healthcheck timeout. Dependencies: product degradation policy.

### P08-07 — Production topology не задаёт resource/connection budgets для большинства сервисов и содержит SPOF

- Category: infra/capacity; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: resource limits заданы только ClamAV и backend (`technozrelost-backend/infra/docker-compose.prod.yml:145-149,200-205`); Primary, Replica, Redis, MinIO, frontend, nginx, Prometheus и Grafana их не имеют. Frontend и nginx имеют по одному container (`docker-compose.prod.yml:446-511`); Redis, MinIO и каждый DB role также singleton (`docker-compose.prod.yml:24-131,161-184`). Repo не задаёт nginx `worker_connections`, process/FD ulimits, Redis `maxmemory`/eviction/maxclients или `stop_grace_period`; nginx config держит SSE до 3600 с (`technozrelost-backend/infra/nginx/nginx.prod.conf:159-175`).
- Safe scenario: 5k/10k sockets требуют доказанного FD/worker budget, которого нет; Redis AOF/pubsub/rate-limit делят singleton memory; без limits любой из DB/Redis/Next/monitoring может вызвать host OOM, а отказ single frontend/nginx/Redis/MinIO/Primary прерывает соответствующий или весь контракт.
- Impact: 1k+ concurrency нельзя обоснованно принять по конфигурации; noisy-neighbor и host-wide failure.
- Remediation: зафиксировать per-service CPU/RAM/PID/FD budgets и alerts; nginx worker/connection sizing; Redis maxmemory policy с отдельным анализом ticket/pubsub semantics; HA topology/load balancing для edge/frontend/stateful dependencies либо документированные RTO/RPO.
- Tests: config contract на budgets; production-like FD/SSE test; cgroup OOM and single-instance failure drills. Dependencies: deployment orchestrator and HA design.

### P08-08 — Timeout/cancellation и graceful shutdown не образуют сквозной контракт

- Category: timeout/retry/shutdown; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: browser API wrapper обычно отменяет через 5 с (`technozrelost-frontend/src/lib/api-client.ts:48-57`), nginx ждёт backend 120 с (`technozrelost-backend/infra/nginx/nginx.prod.conf:128-157`), SQLAlchemy checkout использует default timeout, потому что задаются только pool size/overflow (`technozrelost-backend/app/core/database.py:21-32`), а ClamAV/file paths не имеют overall timeout (P08-01). NextAuth login/refresh fetch вообще без timeout (`technozrelost-frontend/src/auth.config.ts:37-47,81-101`). Lifespan отменяет scheduler, но не закрывает DB engines/Redis/storage resources (`technozrelost-backend/app/main.py:92-102`); uvicorn запускается без graceful timeout, Compose не задаёт `stop_grace_period` (`technozrelost-backend/infra/backend-entrypoint.sh:134-135`).
- Safe scenario: client abandons a request at 5 s while upstream/DB/storage budget allows materially longer work; reconnect/poll requests add work before old dependency I/O is proven cancelled. During deploy, long SSE/file calls and unbounded scheduler transaction have no repository-defined maximum drain time.
- Impact: duplicate/in-flight work, pool/thread queues after client timeout, nondeterministic deploy duration and interrupted writes.
- Remediation: one propagated deadline/cancellation policy per route class; DB statement/pool timeouts below edge timeout; idempotency keys for retried writes; explicit shutdown order and budgets (stop accepting, drain, cancel, close Redis/engines).
- Tests: disconnect cancellation reaches DB/storage mock; no duplicate write after timeout/retry; SIGTERM harness with active SSE/upload/scheduler exits within budget. Dependencies: deployment termination policy.

## Положительные ограничители и остаточный риск

- Registry/project/executor public paths имеют bounded page sizes; project registry/executors используют keyset where implemented (`technozrelost-backend/app/api/v1/nioktr.py:163-189`, `technozrelost-backend/app/api/v1/executors.py:197-249`). Nginx и application rate limits защищают registry/auth, но не внутренние unbounded feeds (`technozrelost-backend/infra/nginx/nginx.prod.conf:128-157`).
- SSE не удерживает DB session после snapshot (`technozrelost-backend/app/api/v1/realtime.py:156-198`), fallback queue bounded до 100 (`realtime.py:241-254`), AI имеет semaphore/queue/upstream timeout и fallback (`technozrelost-backend/app/services/ai_assistant.py:21-28,56-111`). Эти guards не устраняют client-pool leak, split-brain fallback и отсутствие global admission control.
- Auth/registry Redis sync I/O вынесен в threadpool и имеет socket timeout 1 с (`technozrelost-backend/app/services/auth_throttle.py:47-71,99-154`, `technozrelost-backend/app/api/v1/nioktr.py:33-52,68-120`), но каждый request делает `PING` до рабочей команды. При Redis outage это создаёт до секунды thread work на каждый запрос и per-process fallback semantics; требуются outage/concurrency measurements.
- BLOCKED: production-like load/failover/soak, DB `EXPLAIN (ANALYZE, BUFFERS)`, live Redis/MinIO/ClamAV introspection и graceful SIGTERM drill запрещены условиями read-only аудита и отсутствием безопасного стенда. Ни один capacity tier не считается подтверждённым до перечисленных измерений.
