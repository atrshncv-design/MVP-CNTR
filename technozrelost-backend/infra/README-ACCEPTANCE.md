# Приёмка P1: нагрузка, бэкапы, алерты (таск 10, G43–G45/G47/G48)

Зона: `technozrelost-backend/infra/`. К живому серверу Beget обращается
только оператор по разделу 1; исполнитель таска эти команды НЕ запускает.

## 1. Нагрузочный harness G47 (методика — таск 08)

Пороги (бриф 2026-09-16, история 44/G47): успех ≥99%, API p95 ≤1с,
страницы p95 ≤2с, RAM <80% — НЕ менялись. Скрипт `infra/acceptance_load.py`
(только stdlib, без dev-зависимостей): каждый воркер циклично бьёт
`GET /api/v1/health`, `GET /api/v1/projects/registry?limit=20` (API)
и `GET /` (страница), RAM меряется до/после через `/proc/meminfo`
(Linux) или `sysctl`/`vm_stat` (macOS-стенд). Выход: 0 PASS, 1 FAIL,
2 ошибка; JSON-отчёт `--report` (поля `mode`, `auth_users`,
`rate_limited_expected`, `failed` — сверх гейтовых метрик).

### Почему первый прод-прогон (2026-09-17) не засчитан

Диагноз принят как факт, не перепроверялся: success 74.7% (10% HTTP 429
на `GET /projects/registry`), page p95 3.06–3.5с при 50 concurrent,
API p95 0.3с PASS, RAM 22% PASS. Разбор:

- 429 — срабатывание защиты от накруток, а не деградация: весь hammer
  шёл с одного IP и упёрся в анонимный лимит реестра
  (`registry_anon_limit=120/60с`). Тест измерял один адрес, а не живых
  людей. Лимиты при этом НЕ ослабляются (накрутки резать обязаны):
  ни прикладные (`app/core/config.py`), ни nginx-зоны
  (`registry 100r/s`, `auth 10r/s`) не тронуты.
- page p95 — узкое место SSR фронта на лимите 0.75 CPU (бэкенд при этом
  отдавал API p95 0.3с — запас есть). Лечится мощностью, см. конверт ниже.

### Методика: распределённые пользователи вместо одного IP

- **Auth-прогон (гейтовый):** `--auth-users N` — harness регистрирует N
  тестовых пользователей (`POST /api/v1/auth/register`, роль
  `gk_customer` из allowlist саморегистрации, синтетические email
  `acceptance-load-*@load.local`) и раздаёт воркерам Bearer round-robin;
  пробы реестра идут аутентифицированными под высокий auth-лимит
  (`registry_auth_limit=10000/60с`). Любой 429 здесь — провал.
  Именно auth-прогон закрывает четыре порога.
- **Anon-прогон (проверка защиты):** `--auth-users 0` — пробы без
  Authorization; ожидаемый 429 с главой `X-Error-Code:
  REGISTRY_RATE_LIMITED` провалом НЕ считается (защита сработала
  штатно), 429 без главы или с чужой главой — провал.
- Bearer несут только пробы реестра (единственная ручка под лимитом);
  health и страницы идут анонимно, как у живых посетителей.

Локально (стенд уже поднят через `deploy.sh` или dev-compose):

```bash
cd technozrelost-backend
python3 infra/acceptance_load.py --api-url http://127.0.0.1:8000 \
  --page-url http://127.0.0.1:3000 --concurrency 50 --requests 500 \
  --auth-users 50 --report reports/acceptance-load.json
# Anon-проверка защиты (ожидаемые 429 — не провал):
python3 infra/acceptance_load.py --api-url http://127.0.0.1:8000 \
  --page-url http://127.0.0.1:3000 --concurrency 50 --requests 500 \
  --report reports/acceptance-load-anon.json
```

Точные команды для оператора против Beget (выполняет владелец/оператор
на своей машине с доступом к серверу, НЕ исполнитель):

```bash
cd MVP-CNTR/technozrelost-backend
python3 infra/acceptance_load.py \
  --api-url https://<PUBLIC_HOST> --page-url https://<PUBLIC_HOST> \
  --concurrency 50 --requests 500 --auth-users 50 \
  --report reports/acceptance-load-beget.json
python3 infra/acceptance_load.py \
  --api-url https://<PUBLIC_HOST> --page-url https://<PUBLIC_HOST> \
  --concurrency 50 --requests 500 \
  --report reports/acceptance-load-beget-anon.json
# Ожидание: ACCEPTANCE PASS в обоих прогонах; иначе — отчёт в work/report.md
# не закрывать, контур не открывать (история 44/G47: нагрузка только по порогам).
# После auth-прогона удалить синтетических учёток acceptance-load-*@load.local.
```

`<PUBLIC_HOST>` — техническое имя вида `1-2-3-4.sslip.io` (таск 07)
или собственный домен (R08). Замер валиден только при верифицированном
TLS без `-k`.

### Конверт под page p95 (таск 08): фронт 0.75 → 1.25 CPU в пределах 6.0/8 ГиБ

Сумма лимитов не выросла: +0.5 CPU фронту добраны из резервов
простаивающих sidecar (все — вне горячего пути запросов):
backup-timer 0.25→0.10 (спит до BACKUP_AT), wal-offsite 0.15→0.10
(килобайтные копии раз в 60с), prometheus 0.5→0.4 (только скрап раз
в 15с), grafana 0.25→0.10 (SSH-туннель, простаивает), alerter 0.1→0.05
(пробы раз в 60с). Итог 6.0 vCPU / 7680M — таблица «Ресурсный конверт P1»
в `infra/README-DEPLOY.md` пересчитана, гейт `infra/preflight.py`
проверяет новые цифры (суммы ≤6.0/8 ГиБ плюс пол CPU фронта ≥1.25 —
тихий откат к 0.75 отклоняется до сборки).

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
