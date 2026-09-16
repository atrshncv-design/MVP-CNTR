# Приёмка P1: нагрузка, бэкапы, алерты (таск 10, G43–G45/G47/G48)

Зона: `technozrelost-backend/infra/`. К живому серверу Beget обращается
только оператор по разделу 1; исполнитель таска эти команды НЕ запускает.

## 1. Нагрузочный harness G47

Пороги (бриф 2026-09-16, история 44/G47): успех ≥99%, API p95 ≤1с,
страницы p95 ≤2с, RAM <80%. Скрипт `infra/acceptance_load.py` (только
stdlib, без dev-зависимостей): каждый воркер циклично бьёт
`GET /api/v1/health`, `GET /api/v1/projects/registry?limit=20` (API)
и `GET /` (страница), RAM меряется до/после через `/proc/meminfo`
(Linux) или `sysctl`/`vm_stat` (macOS-стенд). Выход: 0 PASS, 1 FAIL,
2 ошибка; JSON-отчёт `--report`.

Локально (стенд уже поднят через `deploy.sh` или dev-compose):

```bash
cd technozrelost-backend
python3 infra/acceptance_load.py --api-url http://127.0.0.1:8000 \
  --page-url http://127.0.0.1:3000 --concurrency 50 --requests 500 \
  --report reports/acceptance-load.json
```

Точная команда для оператора против Beget (выполняет владелец/оператор
на своей машине с доступом к серверу, НЕ исполнитель):

```bash
cd MVP-CNTR/technozrelost-backend
python3 infra/acceptance_load.py \
  --api-url https://<PUBLIC_HOST> --page-url https://<PUBLIC_HOST> \
  --concurrency 50 --requests 500 --report reports/acceptance-load-beget.json
# Ожидание: ACCEPTANCE PASS; иначе — отчёт в work/report.md не закрывать,
# контур не открывать (история 44/G47: нагрузка только по порогам).
```

`<PUBLIC_HOST>` — техническое имя вида `1-2-3-4.sslip.io` (таск 07).
Замер валиден только при верифицированном TLS без `-k`.

## 2. Backup/restore-репетиция (G43; offsite G44 — блокер)

Всё — локально/изолированно, в пустую БД. Оффсайт отсутствует
(ответ «Пока нет», история 41/G44): это зафиксированный боевой блокер,
хранилище НЕ импровизируется — репетиция покрывает только локальный
сценарий, RPO/RTO прод-контура она не доказывает.

```bash
cd technozrelost-backend
# 2.1. Принудительный бэкап мимо deploy-маркеров (коды backup-lock.py:
#      0 готово, 3 занято, 1 ошибка, 2 usage):
BACKUP_DIR=/tmp/tz-rehearsal BACKUP_FORCE=1 \
  python3 infra/backup-lock.py --manual ./infra/backup.sh
# 2.2. Проверка чексумм до любых изменений:
SNAP="$(ls -1dt /tmp/tz-rehearsal/20*/ | head -1)"
(cd "$SNAP" && sha256sum -c SHA256SUMS)
test -s "$SNAP/pg_basebackup/PG_VERSION" && test -d "$SNAP/minio"
# 2.3. Disposable restore в ПУСТУЮ тестовую БД (restore.sh падает кодом 2
#      на непустой БД — это норма, fail-closed; P2 в RUNBOOK-DATA.md):
RESTORE_CONFIRM=1 POSTGRES_DB=<пустая_тестовая_бд> \
  sh infra/restore.sh "$SNAP"
# 2.4. Сверить данные, каталог репетиции удалить: rm -rf /tmp/tz-rehearsal
```

Ожидание: бэкап код 0 + маркер свежести, `sha256sum -c` OK, restore
воспроизводит данные. PITR-цепочка — отдельно `scripts/rehearse_pitr.sh`.

## 3. Синтетический алерт до Telegram БЕЗ секретов (G45)

Dry-run до точки ввода секретов (сети нет, значений нет — только имена):

```bash
cd technozrelost-backend
python3 infra/acceptance_alert_dryrun.py   # DRY-RUN, отправки не было
python3 infra/alerter/alerter.py --self-check  # без сети и без Telegram
```

Чек-лист ввода секретов владельцем (значения — только в
`infra/.env.production` на сервере, никогда в переписку/git):

- [ ] `TELEGRAM_BOT_TOKEN` получен у BotFather, вставлен в `.env.production`;
- [ ] `TELEGRAM_CHAT_ID` чата дежурного вставлен туда же;
- [ ] `docker compose ... up -d alerter` перезапущен, в логах нет
      `notifications disabled`;
- [ ] живая проверка: остановить тестовый контейнер → сообщение `[ALERT]`
      в чате → поднять → сообщение `[RECOVERY]`;
- [ ] состояние дедупликации — named volume `alerter-state-prod-data`.

Без выполненного чек-листа доставка алертов считается недоказанной
(боевой блокер «секреты владельца»).

## 4. Решение по BACKUP_KEEP (таск 10, п.5)

Спека (§Решения, история 40/G43): диск 150 ГБ держит «3–7 локальных
снапшотов». Каждый снапшот — ПОЛНАЯ копия (pg_dump + physical
pg_basebackup + полное зеркало MinIO, см. `backup.sh`), поэтому
retention 14 противоречит бюджету: 14 полных копий диск не переживёт.
Решение: **снизить retention до 7** (верхняя граница бюджета),
дефолт `BACKUP_KEEP=7` в `backup.sh`, `docker-compose.prod.yml`,
`.env.production.example`, `RUNBOOK-DATA.md`. RPO «до суток»
(история 40/G43) при этом сохраняется: ежедневный полный снапшот
покрывает окно 7 дней назад, старше — только после появления offsite.
