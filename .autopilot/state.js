window.STATE =
{
  "slug": "m0-security-hardening",
  "dir": "2026-08-26-m0-security-hardening--wip",
  "title": "M0: гигиена и безопасность платформы (P0 + CI)",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-08-26-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-08-26T15:00:10+04:00",
  "updatedAt": "2026-08-26T15:23:18+04:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-08-26T15:00:10+04:00", "finishedAt": "2026-08-26T15:01:36+04:00" },
    { "id": "manifest",  "status": "done", "startedAt": "2026-08-26T15:01:36+04:00", "finishedAt": "2026-08-26T15:09:44+04:00" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-08-26T15:01:36+04:00", "finishedAt": "2026-08-26T15:09:44+04:00" },
    { "id": "spec",      "status": "done", "startedAt": "2026-08-26T15:09:44+04:00", "finishedAt": "2026-08-26T15:18:19+04:00" },
    { "id": "plan",      "status": "done", "startedAt": "2026-08-26T15:18:19+04:00", "finishedAt": "2026-08-26T15:23:18+04:00" },
    { "id": "build",     "status": "active", "startedAt": "2026-08-26T15:23:18+04:00" },
    { "id": "build",     "status": "pending" },
    { "id": "review",    "status": "pending" },
    { "id": "final",     "status": "pending" }
  ],
  "requirements": {
    "total": 21, "done": 0, "inTicket": 18, "inSpec": 3,
    "placeholder": 0, "deferred": 3, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Безопасность бэкенда: модерация, сессии, загрузки, пул", "requirements": ["R01", "R15", "R16", "R14", "R17i"], "blockedBy": [], "wave": 1, "zone": ["technozrelost-backend/app/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "02", "title": "Доступ фронта: fail-closed матрица ролей и единый адрес API", "requirements": ["R02", "R03", "R17i"], "blockedBy": [], "wave": 1, "zone": ["technozrelost-frontend/src/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "03", "title": "Документы для заказчика: сервер и импортозамещение", "requirements": ["R05", "R06"], "blockedBy": [], "wave": 1, "zone": ["docs/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "04", "title": "Сохранность данных: бэкапы по расписанию, WAL/PITR, слот, offsite", "requirements": ["R07", "R08", "R09", "R10", "R17i"], "blockedBy": [], "wave": 1, "zone": ["technozrelost-backend/infra/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "05", "title": "Край контура: Telegram-алерты, откат деплоя, Grafana внутрь", "requirements": ["R11", "R12", "R13", "R17i"], "blockedBy": ["04"], "wave": 2, "zone": ["technozrelost-backend/infra/docker-compose.prod.yml", "deploy.sh", "infra/alerter/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "06", "title": "CI-конвейер GitHub Actions", "requirements": ["R04", "R17i"], "blockedBy": ["01"], "wave": 2, "zone": [".github/workflows/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 }
  ],
  "singlePass": null,
  "tests": null,
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": { "gate": "G2", "findings": 4, "missed": 2, "half": 2, "extra": 4, "resolution": "2 пропуска и 2 половины закрыты правками спеки (срок 30.09, критерий done в BACKLOG, таблица соответствия P0↔истории, база main); 4 «лишних» — это углубления R##.n целей владельца (RPO из интервью, mypy как часть P-12), оставлены с привязкой" },
  "concerns": [],
  "reviewers": { "manifestSpec": null, "craft": null },
  "blind": null
}
