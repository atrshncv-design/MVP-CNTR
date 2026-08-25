# Production image: technozrelost-backend (FastAPI + uv)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY db ./db
# README нужен uv: метаданные проекта ссылаются на него (readme = "README.md")
COPY README.md ./README.md
RUN uv sync --frozen --no-dev

FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONUNBUFFERED=1
# Кириллический шрифт для PDF-заключений (reportlab, тикет 09);
# postgresql-client — pg_dump для backup.sh перед миграциями (тикет 20).
# Клиент ставим МАЖОРНОСТИ СЕРВЕРА (PG16) из pgdg: клиент из bookworm (v15)
# отказывается работать с сервером 16 — «server version mismatch».
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg fonts-dejavu-core \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
         https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
         > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/.venv ./.venv
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY db ./db
# Seed-данные НИОКТР (seed_gost/seed_nioktr/seed_templates выполняются в контейнере)
COPY data ./data
# Входная точка: ожидание Primary → миграции под advisory lock → uvicorn (тикет 18)
COPY infra/backend-entrypoint.sh ./backend-entrypoint.sh
RUN chmod +x ./backend-entrypoint.sh
# Бэкап перед миграциями (тикет 20); pg_dump из postgresql-client, MinIO — python-minio
COPY infra/backup.sh ./backup.sh
RUN chmod +x ./backup.sh
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["/app/backend-entrypoint.sh"]
