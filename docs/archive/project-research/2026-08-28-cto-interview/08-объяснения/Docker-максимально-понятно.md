# Docker — максимально понятно (на твоём стеке)

## Что это
Docker — коробка для программы с её зависимостями. `technozrelost-backend/Dockerfile` коробка для FastAPI + `pgvector`, `technozrelost-frontend/Dockerfile` для Next.js. Без Docker — ставишь Python 3.11, Node 22, PG 16 руками на каждый хост.

## Зачем тебе
- `infra/docker-compose.yml` (dev) `pg-primary:5432` + `pg-replica:5433` + `minio:9000` + `clamav:3310` — `up -d` поднимает всё одной командой, как у тебя локально.
- `infra/docker-compose.prod.yml` — тот же `compose` но с `deploy.replicas:2` `backend` (2 коробки API за nginx), `wal-archive-prod-data` том, `backup-timer`, `wal-offsite`, `alerter`, `prometheus/grafana` — прод.

## Почему 2 реплики backend
`nginx/nginx.prod.conf:1` `upstream technozrelost_api` round-robin -> `backend:8000` x2. Если 1 упадёт, второй держит 714 RPS 5К. Без Docker — ставил бы 2 `systemd` руками.

## Ресурсы
Каждая коробка с лимитом `deploy.resources.limits` `INF-08` (иначе ClamAV съест RAM). `image` `pgvector/pgvector:0.8.0-pg16` — PG с вектором, `minio:latest` — файлы, `clamav:alpine` — антивирус.

Docker — не про RAM, про изоляцию и `up -d` одной командой.
