window.STATE =
{
  "slug": "m0-security-hardening",
  "dir": "2026-08-26-m0-security-hardening",
  "title": "M0: гигиена и безопасность платформы (P0 + CI)",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-08-26-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-08-26T15:00:10+04:00",
  "updatedAt": "2026-08-28T09:55:00+04:00",
  "finishedAt": "2026-08-28T09:55:00+04:00",
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-08-26T15:00:10+04:00", "finishedAt": "2026-08-26T15:01:36+04:00" },
    { "id": "manifest",  "status": "done", "startedAt": "2026-08-26T15:01:36+04:00", "finishedAt": "2026-08-26T15:09:44+04:00" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-08-26T15:01:36+04:00", "finishedAt": "2026-08-26T15:09:44+04:00" },
    { "id": "spec",      "status": "done", "startedAt": "2026-08-26T15:09:44+04:00", "finishedAt": "2026-08-26T15:18:19+04:00" },
    { "id": "plan",      "status": "done", "startedAt": "2026-08-26T15:18:19+04:00", "finishedAt": "2026-08-26T15:23:18+04:00" },
    { "id": "build",     "status": "done", "startedAt": "2026-08-26T15:23:18+04:00", "finishedAt": "2026-08-27T08:48:39+04:00" },
    { "id": "review",    "status": "done", "startedAt": "2026-08-27T08:48:39+04:00", "finishedAt": "2026-08-28T09:55:00+04:00" },
    { "id": "final",     "status": "done", "startedAt": "2026-08-28T09:55:00+04:00", "finishedAt": "2026-08-28T09:55:00+04:00" }
  ],
  "requirements": {
    "total": 21, "done": 8, "externalPending": 9, "inTicket": 0, "inSpec": 1,
    "placeholder": 0, "deferred": 3, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Безопасность бэкенда: модерация, сессии, загрузки, пул", "requirements": ["R01", "R15", "R16", "R14"], "blockedBy": [], "wave": 1, "zone": ["technozrelost-backend/app/"], "status": "done", "startedAt": "2026-08-26T15:26:34+04:00", "finishedAt": "2026-08-26T16:52:00+04:00", "tests": {"passed": "local backend 334", "failed": 0}, "commit": "32b3985", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "02", "title": "Доступ фронта: fail-closed матрица ролей и единый адрес API", "requirements": ["R02", "R03"], "blockedBy": [], "wave": 1, "zone": ["technozrelost-frontend/src/"], "status": "done", "startedAt": "2026-08-26T15:26:34+04:00", "finishedAt": "2026-08-26T17:24:00+04:00", "tests": {"passed": "frontend 39", "failed": 0}, "commit": "0a94ba1 + 7f6ad43", "retries": 0, "repairs": 1, "handoffs": 0 },
    { "id": "03", "title": "Документы для заказчика: сервер и импортозамещение", "requirements": ["R05", "R06"], "blockedBy": [], "wave": 1, "zone": ["docs/"], "status": "done", "startedAt": "2026-08-26T15:26:34+04:00", "finishedAt": "2026-08-26T17:38:00+04:00", "tests": {"passed": "local review", "failed": 0}, "commit": "8c065b7", "retries": 0, "repairs": 1, "handoffs": 0 },
    { "id": "04", "title": "Сохранность данных: бэкапы по расписанию, WAL/PITR, слот, offsite", "requirements": ["R07", "R08", "R09", "R10", "R17i"], "blockedBy": [], "wave": 1, "zone": ["technozrelost-backend/infra/"], "status": "done", "startedAt": "2026-08-26T16:36:16+04:00", "finishedAt": "2026-08-28T09:55:00+04:00", "tests": {"passed": "focused 56 + backend 334", "failed": 0}, "commit": "aa783b6 (baseline only; repairs dirty)", "retries": 0, "repairs": 6, "handoffs": 0, "concerns": ["dirty repairs are uncommitted", "offsite and production-like PITR verification require operator crypt remote/config and capacity"] },
    { "id": "05", "title": "Край контура: Telegram-алерты, откат деплоя, Grafana внутрь", "requirements": ["R11", "R12", "R13", "R17i"], "blockedBy": ["04"], "wave": 2, "zone": ["technozrelost-backend/infra/docker-compose.prod.yml", "deploy.sh", "infra/alerter/"], "status": "done", "startedAt": "2026-08-26T18:46:50+04:00", "finishedAt": "2026-08-28T09:55:00+04:00", "tests": {"passed": "alerter 28; focused green", "failed": 0}, "commit": "bb7b0f8 + 40b4040 (baseline only; repairs dirty)", "retries": 1, "repairs": 5, "handoffs": 0, "concerns": ["Telegram delivery, deploy rollback and production smoke are unverified"] },
    { "id": "06", "title": "CI-конвейер GitHub Actions", "requirements": ["R04", "R17i"], "blockedBy": ["01"], "wave": 2, "zone": [".github/workflows/"], "status": "done", "startedAt": "2026-08-26T18:46:50+04:00", "finishedAt": "2026-08-28T09:55:00+04:00", "tests": {"passed": "local gates green (backend 334, frontend 39)", "failed": 0}, "commit": "4e570d0 (baseline only; repairs dirty)", "retries": 0, "repairs": 0, "handoffs": 0, "concerns": ["remote GitHub Actions has not been checked"] }
  ],
  "singlePass": null,
  "tests": { "passed": 334, "failed": 0, "scope": "local backend 334 single process; frontend 39, lint/build, ruff/mypy and audits green; infra 56 + alerter 28; external CI and production verification pending" },
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "BACKUP_OFFSITE_REMOTE"] },
  "additions": [],
  "coverage": { "gate": "G2", "findings": 4, "missed": 2, "half": 2, "extra": 4, "resolution": "2 пропуска и 2 половины закрыты правками спеки (срок 30.09, критерий done в BACKLOG, таблица соответствия P0↔истории, база main); 4 «лишних» — это углубления R##.n целей владельца (RPO из интервью, mypy как часть P-12), оставлены с привязкой" },
  "concerns": [
    "HEAD remains 7f6ad43; later backend/infra repairs are dirty and uncommitted, so no existing commit hash covers them",
    "remote GitHub Actions was not checked",
    "production deploy, offsite/PITR, Telegram delivery and rollback live smoke require operator crypt remote/config and production-like capacity",
    "T01/craft: дубликат хелпера priority_share_sig в test_join_mechanic.py и support.py — свести к одному",
    "T01/craft: тест подделанной подписи не различает «verify отклонил» и «verify не вызывался»",
    "T01/craft: невалидная share_sig молча деградирует до ручного пути вместо явного отказа — задокументировать как осознанный fail-closed выбор",
    "T01: chunked-middleware буферизует тело до лимита перед ответом 413 — приёмлемо для 32 МБ, помнить при повышении лимитов",
    "T02/craft: проверка литералов идёт по исходникам, а критерий — про собранный бандл; добавить проверку .next/static после build",
    "T02/craft: middleware-тест стоит на тексте исходника (regex), а не на поведении запрета",
    "T02/craft: состав ALL_ROLES ничем не приколот к полному набору ролей",
    "T02/craft: обходчик матрицы односторонний — устаревшие ключи без маршрутов не валят тест",
    "T03/craft: текстовая оценка «~10,5 ГБ» расходится с суммой собственной таблицы (10,85 ГБ)",
    "T03/craft: утверждение об отсутствии российских аналогов React-фреймворков в реестре без пометки [проверить]",
    "T04/craft: дефолтное имя отчёта rehearse_pitr.sh захардкожено датой первого прогона",
    "T04: offsite evidence is pending; local rehearsal does not prove offsite RPO/RTO",
    "T05: production smoke is pending; no destructive Docker cleanup was performed",
    "T06: remote GitHub Actions is pending",
    "infra: полный ruff check . выявляет 5 старых ошибок в alembic; CI ограничен app tests",
    "graphify: текущие сгенерированные .graphify artifacts не проходят portable-check и не включены в коммиты"
  ],
  "reviewers": { "manifestSpec": "ses_fc1cba646ffeWKTRVKEvPKs31n", "craft": "ses_fc1cb615fffeYnG419aVH80X2B" },
  "blind": {
    "status": "drift",
    "summary": "8 требований done подтверждены blind; 9 — code/local done, external pending (требуют production smoke/crypt remote); deferred 3 — вне рамок",
    "drift": [
      "R04, R07-R13, R17i: manifest code/local done; blind частично — код есть, live production evidence отсутствует (ожидаемо, dirty repairs + операторский remote)",
      "R08 PITR: локальный PASS есть, production PITR/offsite не доказан — manifest честно помечен external pending",
      "R10 offsite: crypt-only guard есть, live offsite не показан — согласованный drift",
      "R11 Telegram, R12 rollback: реализованы локально, доставка/откат не предъявлены live"
    ],
    "agreed": ["R01","R02","R03","R05","R06","R14","R15","R16"],
    "commands": "uv run pytest -q → 334 passed; npm test → 39 passed; ruff/mypy, lint/build, compose config — зелёно; dev pg-primary/pg-replica healthy, slot active, streaming"
  }
}
