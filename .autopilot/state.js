window.STATE =
{
  "slug": "audit-remediation",
  "dir": "2026-09-08-audit-remediation",
  "title": "Спека и таски исправлений по аудиту aeecb2d",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T3",
  "briefFile": "2026-09-08-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-09-08T08:43:09+04:00",
  "updatedAt": "2026-09-08T08:53:26+04:00",
  "finishedAt": "2026-09-08T08:53:26+04:00",
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-09-08T08:43:09+04:00", "finishedAt": "2026-09-08T08:44:00+04:00" },
    { "id": "manifest", "status": "done", "startedAt": "2026-09-08T08:44:00+04:00", "finishedAt": "2026-09-08T08:46:49+04:00", "note": "7 требований" },
    { "id": "briefing", "status": "done", "startedAt": "2026-09-08T08:44:00+04:00", "finishedAt": "2026-09-08T08:46:49+04:00", "note": "охват: всё + приоритеты" },
    { "id": "spec", "status": "done", "startedAt": "2026-09-08T08:46:49+04:00", "finishedAt": "2026-09-08T08:49:05+04:00", "note": "G2 pass" },
    { "id": "plan", "status": "done", "startedAt": "2026-09-08T08:49:05+04:00", "finishedAt": "2026-09-08T08:51:41+04:00", "note": "16 тасков, ярус T3" },
    { "id": "build", "status": "skipped", "startedAt": "2026-09-08T08:51:41+04:00", "finishedAt": "2026-09-08T08:53:26+04:00", "note": "вне объёма: только спека и таски" },
    { "id": "review", "status": "skipped", "startedAt": "2026-09-08T08:53:26+04:00", "finishedAt": "2026-09-08T08:53:26+04:00", "note": "кода нет — ревью нечего" },
    { "id": "final", "status": "done", "startedAt": "2026-09-08T08:51:41+04:00", "finishedAt": "2026-09-08T08:53:26+04:00", "note": "слепая приёмка 4/4" }
  ],
  "requirements": {
    "total": 7, "done": 0, "inTicket": 4, "inSpec": 3,
    "placeholder": 0, "deferred": 0, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Redis как обязательная прод-зависимость", "requirements": ["R03i"], "blockedBy": [], "wave": 1, "zone": ["backend/deps", "backend/health", "infra/compose"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "02", "title": "Метрики с ограниченной кардинальностью", "requirements": ["R03i"], "blockedBy": [], "wave": 1, "zone": ["backend/observe"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "03", "title": "Закрытая выдача привилегированных ролей", "requirements": ["R04i"], "blockedBy": [], "wave": 1, "zone": ["backend/auth"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "04", "title": "SSE по одноразовому ticket вместо токена в URL", "requirements": ["R04i"], "blockedBy": [], "wave": 1, "zone": ["backend/realtime", "frontend/notify", "infra/nginx"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "05", "title": "Честные лимиты и закрытый реестр специалистов", "requirements": ["R05i"], "blockedBy": [], "wave": 1, "zone": ["backend/registry"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "06", "title": "Атомарная ротация refresh-токенов", "requirements": ["R05i"], "blockedBy": ["03"], "wave": 2, "zone": ["backend/auth"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "07", "title": "Лимит тела запроса на балансировщике под загрузки", "requirements": ["R05i"], "blockedBy": ["04"], "wave": 2, "zone": ["infra/nginx"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "09", "title": "Миграции только с готовым бэкапом", "requirements": ["R05i"], "blockedBy": [], "wave": 2, "zone": ["infra/backup"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "10", "title": "Offline-очередь без секретов и потерь", "requirements": ["R05i"], "blockedBy": [], "wave": 2, "zone": ["frontend/offline"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "11", "title": "LLM-путь: очередь, изоляция промпта, строгий парсинг", "requirements": ["R05i"], "blockedBy": [], "wave": 2, "zone": ["backend/ai"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "13", "title": "Витрина лендинга на живых данных реестра", "requirements": ["R06i"], "blockedBy": [], "wave": 2, "zone": ["frontend/landing"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "12", "title": "Настоящие эмбеддинги и честный rerank", "requirements": ["R05i"], "blockedBy": ["11"], "wave": 3, "zone": ["backend/ai", "db/rag"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "14", "title": "Пакет P2: пагинация, N+1, CHECK, readiness, секреты", "requirements": ["R06i"], "blockedBy": [], "wave": 3, "zone": ["backend/admin", "backend/teams", "db/core", "infra/compose"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "08", "title": "Зелёные гейты: линт, типы, сюита, сборки", "requirements": ["R05i"], "blockedBy": ["15", "16"], "wave": 4, "zone": ["tests/gates", "ci"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "15", "title": "Пакет P3 (приложение): инвайты, CSP, CSRF", "requirements": ["R06i"], "blockedBy": ["14"], "wave": 4, "zone": ["backend/teams", "frontend/shell", "docs"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "16", "title": "Пакет P3 (инфра): restore, WAL, алерты, мониторинг, деплой", "requirements": ["R06i"], "blockedBy": ["09", "14"], "wave": 4, "zone": ["infra/backup", "infra/observe", "infra/deploy"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 }
  ],
  "singlePass": null,
  "tests": null,
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": {
    "firstPassFindings": 0,
    "fixed": 0,
    "recheckFindings": 0,
    "status": "pass",
    "extra": 0,
    "extraNote": "G2 independent: missing 0, half-covered 0; раздел 3 (в спеке, нет в брифе) разобран — всё природителено к Дополнениям брифа (аудит aeecb2d + решение «Всё + приоритеты»), A## без родителя нет, вырезать нечего"
  },
  "concerns": [],
  "reviewers": { "manifestSpec": null, "craft": null },
  "blind": {
    "status": "pass",
    "summary": "4/4 строки брифа покрыты спекой и 16 тасками; лишнего без заказа нет",
    "open": []
  }
}
