# Деплой платформы «Технозрелость» (production)

Стек: **Docker Compose** — frontend (Next.js 16), backend (FastAPI), PostgreSQL (pgvector), nginx (HTTPS-прокси).

## Требования
- Linux-сервер (Ubuntu/Debian рекомендуются) или macOS с Docker Desktop
- Docker + Docker Compose v2
- 2+ ГБ RAM, 10+ ГБ диска

## Шаги (15 минут)

```bash
# 1. Скопировать репозиторий на сервер
git clone https://github.com/atrshncv-design/MVP-CNTR.git
cd "MVP ПЛАТФОРМЫ 2/technozrelost-backend"

# 2. Подготовить окружение
cp .env.production.example infra/.env.production
#    — заполнить POSTGRES_PASSWORD, NEXTAUTH_URL, CORS_ORIGINS
#    — JWT_SECRET / NEXTAUTH_SECRET сгенерируются автоматически при деплое

# 3. Запустить (одна команда)
./infra/deploy.sh
```

## Проверка

```bash
curl -s http://localhost/api/v1/health        # {"status":"ok",...}
curl -sk https://localhost/api/v1/health      # то же по HTTPS
```

## Наполнение данными (разово, после первого запуска)

```bash
docker compose -f infra/docker-compose.prod.yml exec backend sh -c \
  "python -m app.db.seed_gost && python -m app.db.seed_nioktr && python -m app.db.seed_templates"
```

- `seed_gost` — ГОСТы из папки «ГОСТЫ» (копируются в образ при сборке; пересборка после добавления файлов)
- `seed_nioktr` — выборка НИОКТР (400 карточек, уже в репозитории)
- `seed_templates` — шаблоны документов ТЗ/Паспорт/ТЭО

## HTTPS

По умолчанию deploy.sh генерирует **самоподписанный** сертификат. Для настоящего HTTPS:

1. Настроить DNS: A-запись домена на IP сервера.
2. Выпустить сертификат (certbot в docker или на хосте) для `NEXTAUTH_URL`.
3. Положить `fullchain.pem` / `privkey.pem` в `infra/nginx/certs/`.
4. `docker compose -f infra/docker-compose.prod.yml restart nginx`

## Секреты и безопасность

- `JWT_SECRET`, `NEXTAUTH_SECRET` — генерируются автоматически; перезапись ломает сессии (это нормально при первом деплое).
- `LLM_API_KEY` — кладёт Functional Validator (ключ opencode zen, free-модели).
- `.env` и `infra/.env.production` — в `.gitignore`, никогда не коммитить.
