# Production image: technozrelost-backend (FastAPI + uv)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY db ./db
RUN uv sync --frozen --no-dev

FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONUNBUFFERED=1
# Кириллический шрифт для PDF-заключений (reportlab, тикет 09)
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core \
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
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["/app/backend-entrypoint.sh"]
