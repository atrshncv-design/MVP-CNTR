window.STATE =
{
  "slug": "audit-remediation",
  "dir": "2026-09-08-audit-remediation--wip",
  "title": "Спека и таски исправлений по аудиту aeecb2d",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T3",
  "briefFile": "2026-09-08-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-09-08T08:43:09+04:00",
  "updatedAt": "2026-09-08T10:47:57+04:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-09-08T08:43:09+04:00", "finishedAt": "2026-09-08T08:44:00+04:00" },
    { "id": "manifest", "status": "done", "startedAt": "2026-09-08T08:44:00+04:00", "finishedAt": "2026-09-08T08:46:49+04:00", "note": "7 требований" },
    { "id": "briefing", "status": "done", "startedAt": "2026-09-08T08:44:00+04:00", "finishedAt": "2026-09-08T08:46:49+04:00", "note": "охват: всё + приоритеты" },
    { "id": "spec", "status": "done", "startedAt": "2026-09-08T08:46:49+04:00", "finishedAt": "2026-09-08T08:49:05+04:00", "note": "G2 pass" },
    { "id": "plan", "status": "done", "startedAt": "2026-09-08T08:49:05+04:00", "finishedAt": "2026-09-08T08:51:41+04:00", "note": "16 тасков, ярус T3" },
    { "id": "build", "status": "active", "startedAt": "2026-09-08T08:56:53+04:00", "note": "волна 1: 5 тасков" },
    { "id": "review", "status": "pending" },
    { "id": "final", "status": "pending" }
  ],
  "requirements": {
    "total": 9, "done": 0, "inTicket": 4, "inSpec": 4,
    "placeholder": 0, "deferred": 0, "dropped": 1
  },
  "tickets": [
    { "id": "01", "title": "Redis как обязательная прод-зависимость", "requirements": ["R03i"], "blockedBy": [], "wave": 1, "zone": ["backend/deps", "backend/health", "infra/compose"], "status": "in-progress", "startedAt": "2026-09-08T08:57:36+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "02", "title": "Метрики с ограниченной кардинальностью", "requirements": ["R03i"], "blockedBy": [], "wave": 1, "zone": ["backend/observe"], "status": "in-progress", "startedAt": "2026-09-08T08:57:36+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "03", "title": "Закрытая выдача привилегированных ролей", "requirements": ["R04i"], "blockedBy": [], "wave": 1, "zone": ["backend/auth"], "status": "in-progress", "startedAt": "2026-09-08T08:57:36+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "04", "title": "SSE по одноразовому ticket вместо токена в URL", "requirements": ["R04i"], "blockedBy": [], "wave": 1, "zone": ["backend/realtime", "frontend/notify", "infra/nginx"], "status": "in-progress", "startedAt": "2026-09-08T09:05:00+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "05", "title": "Честные лимиты и закрытый реестр специалистов", "requirements": ["R05i"], "blockedBy": [], "wave": 1, "zone": ["backend/registry"], "status": "in-progress", "startedAt": "2026-09-08T09:05:00+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "06", "title": "Атомарная ротация refresh-токенов", "requirements": ["R05i"], "blockedBy": ["03"], "wave": 2, "zone": ["backend/auth"], "status": "in-progress", "startedAt": "2026-09-08T09:36:46+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "07", "title": "Лимит тела запроса на балансировщике под загрузки", "requirements": ["R05i"], "blockedBy": ["04"], "wave": 2, "zone": ["infra/nginx"], "status": "in-progress", "startedAt": "2026-09-08T09:36:46+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "09", "title": "Миграции только с готовым бэкапом", "requirements": ["R05i"], "blockedBy": [], "wave": 2, "zone": ["infra/backup"], "status": "in-progress", "startedAt": "2026-09-08T09:36:46+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "10", "title": "Offline-очередь без секретов и потерь", "requirements": ["R05i"], "blockedBy": [], "wave": 2, "zone": ["frontend/offline"], "status": "in-progress", "startedAt": "2026-09-08T09:42:40+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "11", "title": "LLM-путь: очередь, изоляция промпта, строгий парсинг", "requirements": ["R05i"], "blockedBy": [], "wave": 2, "zone": ["backend/ai"], "status": "in-progress", "startedAt": "2026-09-08T09:42:40+04:00", "retries": 0, "repairs": 1, "handoffs": 0 },
    { "id": "13", "title": "Витрина лендинга на живых данных реестра", "requirements": ["R06i"], "blockedBy": [], "wave": 2, "zone": ["frontend/landing"], "status": "in-progress", "startedAt": "2026-09-08T09:42:40+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "12", "title": "Настоящие эмбеддинги и честный rerank", "requirements": ["R05i"], "blockedBy": ["11"], "wave": 3, "zone": ["backend/ai", "db/rag"], "status": "in-progress", "startedAt": "2026-09-08T09:49:53+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "14", "title": "Пакет P2: пагинация, N+1, CHECK, readiness, секреты", "requirements": ["R06i"], "blockedBy": [], "wave": 3, "zone": ["backend/admin", "backend/teams", "db/core", "infra/compose"], "status": "in-progress", "startedAt": "2026-09-08T09:49:53+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "08", "title": "Зелёные гейты: линт, типы, сюита, сборки", "requirements": ["R05i"], "blockedBy": ["15", "16"], "wave": 4, "zone": ["tests/gates", "ci"], "status": "in-progress", "startedAt": "2026-09-08T10:20:00+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "15", "title": "Пакет P3 (приложение): инвайты, CSP, CSRF", "requirements": ["R06i"], "blockedBy": ["14"], "wave": 4, "zone": ["backend/teams", "frontend/shell", "docs"], "status": "in-progress", "startedAt": "2026-09-08T10:02:13+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "16", "title": "Пакет P3 (инфра): restore, WAL, алерты, мониторинг, деплой", "requirements": ["R06i"], "blockedBy": ["09", "14"], "wave": 4, "zone": ["infra/backup", "infra/observe", "infra/deploy"], "status": "in-progress", "startedAt": "2026-09-08T10:02:13+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "17", "title": "Локализация интерфейса на китайский", "requirements": ["G01"], "blockedBy": [], "wave": 4, "zone": ["frontend/i18n"], "status": "in-progress", "startedAt": "2026-09-08T10:41:29+04:00", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "18", "title": "Локализация интерфейса на хинди", "requirements": ["G02"], "blockedBy": ["17"], "wave": 5, "zone": ["frontend/i18n"], "status": "in-progress", "startedAt": "2026-09-08T10:47:57+04:00", "retries": 0, "repairs": 0, "handoffs": 0 }
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
  "reviewers": { "manifestSpec": "ses_f805caf87ffe7VZYPKHzOp56Vn", "craft": "ses_f805caf73ffe2mPQX0k2JN1mKZ" },
  "blind": {
    "status": "pass",
    "summary": "4/4 строки брифа покрыты спекой и 16 тасками; лишнего без заказа нет",
    "open": []
  }
}
