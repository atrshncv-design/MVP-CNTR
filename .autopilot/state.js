window.STATE =
{
  "slug": "mvp-deploy-scope",
  "dir": "2026-09-15-mvp-deploy-scope",
  "title": "MVP деплой: минимум мощностей и скоуп функций",
  "mode": "interview",
  "depth": "normal",
  "polish": null,
  "tier": "T3",
  "briefFile": "2026-09-16-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-09-15T08:34:37+04:00",
  "updatedAt": "2026-09-21T16:42:09+04:00",
  "finishedAt": "2026-09-21T16:42:09+04:00",
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-09-15T08:34:37+04:00", "finishedAt": "2026-09-15T08:34:59+04:00" },
    { "id": "manifest", "status": "done", "startedAt": "2026-09-15T09:12:55+04:00", "finishedAt": "2026-09-15T09:13:54+04:00", "note": "5 требований, предыдущая оценка отозвана" },
    { "id": "briefing", "status": "done", "startedAt": "2026-09-15T09:13:54+04:00", "finishedAt": "2026-09-16T09:05:02+04:00", "note": "37 вопросов: функции, 3 пакета, сервер, RAG и внешние гейты" },
    { "id": "spec", "status": "done", "startedAt": "2026-09-16T09:05:02+04:00", "finishedAt": "2026-09-16T09:14:29+04:00", "note": "G2 pass после 9 правок: измерения, 12 мес, ПДн, папка ГОСТов" },
    { "id": "plan", "status": "done", "startedAt": "2026-09-16T09:14:29+04:00", "finishedAt": "2026-09-16T09:19:40+04:00", "note": "10 тасков, ярус T3, 4 волны" },
    { "id": "build", "status": "done", "startedAt": "2026-09-16T09:19:40+04:00", "finishedAt": "2026-09-16T12:21:03+04:00", "note": "10 из 10 тасков готовы" },
    { "id": "review", "status": "done", "startedAt": "2026-09-16T10:09:52+04:00", "finishedAt": "2026-09-16T12:21:03+04:00", "note": "проверено 10 из 10" },
    { "id": "final", "status": "done", "startedAt": "2026-09-16T12:21:03+04:00", "finishedAt": "2026-09-21T16:42:09+04:00", "note": "Слепая приёмка: частично; public/ready и 237 frontend tests green, внешние гейты не подтверждены" }
  ],
  "requirements": {
    "total": 63, "done": 60, "inTicket": 0, "inSpec": 0,
    "placeholder": 0, "deferred": 3, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Одноузловая топология P1", "requirements": ["R01", "R04i", "G17", "G18", "G19", "G42"], "blockedBy": [], "wave": 1, "zone": ["technozrelost-backend/infra/"], "status": "done", "startedAt": "2026-09-16T09:22:50+04:00", "finishedAt": "2026-09-16T10:09:52+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 507, "failed": 0 }, "commit": "a455592", "concerns": ["R01 partial: таблица лимитов 6/11/150 — зона 04", "G19: привязка к облаку РФ в runbook", "craft: строковые проверки вместо поведенческих — judgement"] },
    { "id": "02", "title": "Gating P2: реестры и matching скрыты", "requirements": ["G04", "G05", "G06", "G09", "G35", "G36"], "blockedBy": [], "wave": 1, "zone": ["technozrelost-frontend/"], "status": "done", "startedAt": "2026-09-16T09:22:50+04:00", "finishedAt": "2026-09-16T10:51:33+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 189, "failed": 0 }, "commit": "1d7b364", "concerns": ["craft judgement: стабы/тесты gating — несрочно"] },
    { "id": "03", "title": "Роли и регистрация без писем", "requirements": ["G10", "G11", "G20", "G39", "G46"], "blockedBy": [], "wave": 1, "zone": ["technozrelost-backend/app/"], "status": "done", "startedAt": "2026-09-16T09:22:50+04:00", "finishedAt": "2026-09-16T11:07:53+04:00", "retries": 0, "repairs": 1, "handoffs": 0, "tests": { "passed": 11, "failed": 0 }, "commit": "2f56764", "concerns": ["ролей в БД 9, не 8 — границы проверены; craft judgement по тестам"] },
    { "id": "04", "title": "Ресурсный конверт и preflight", "requirements": ["R01", "G15", "G18", "G42", "G47"], "blockedBy": ["01"], "wave": 2, "zone": ["technozrelost-backend/infra/"], "status": "done", "startedAt": "2026-09-16T10:35:00+04:00", "finishedAt": "2026-09-16T11:07:53+04:00", "retries": 0, "repairs": 2, "handoffs": 0, "tests": { "passed": 82, "failed": 0 }, "commit": "6159349", "concerns": ["docs/СЕРВЕР-ТРЕБОВАНИЯ.md хранит старую оценку — чинит T10; BACKUP_KEEP=14 — решает T10; ClamAV ужaт до 1.0 CPU"] },
    { "id": "05", "title": "Контент P2: инфоконтур, ЛК, файлы", "requirements": ["G07", "G08", "G12", "G13", "G14", "G22", "G37", "G38"], "blockedBy": ["02"], "wave": 2, "zone": ["technozrelost-frontend/"], "status": "done", "startedAt": "2026-09-16T10:50:00+04:00", "finishedAt": "2026-09-16T10:56:25+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 197, "failed": 0 }, "commit": "684a7f0", "concerns": ["тесты характеризующие, не поведенческие — e2e-доказательство в T10"] },
    { "id": "06", "title": "RAG-импорт только корпуса ГОСТов", "requirements": ["G50", "G56", "G57", "G58"], "blockedBy": [], "wave": 2, "zone": ["technozrelost-backend/scripts/"], "status": "done", "startedAt": "2026-09-16T10:09:52+04:00", "finishedAt": "2026-09-16T11:07:53+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 7, "failed": 0 }, "commit": "c7b9157", "concerns": ["один sanity-ассерт вне шва — judgement"] },
    { "id": "07", "title": "TLS sslip.io и строгий гейт деплоя", "requirements": ["G02", "G40", "G41"], "blockedBy": ["01"], "wave": 3, "zone": ["technozrelost-backend/infra/"], "status": "done", "startedAt": "2026-09-16T11:07:53+04:00", "finishedAt": "2026-09-16T11:59:21+04:00", "retries": 0, "repairs": 1, "handoffs": 0, "tests": { "passed": 93, "failed": 0 }, "commit": "66cb353", "concerns": ["исполнитель коммитил сам (3710a44) — сверено; живая проверка TLS за оператором/T10"] },
    { "id": "08", "title": "AI-ассистент и RAG через OpenCode Go", "requirements": ["G51", "G52", "G53", "G54", "G55", "G56"], "blockedBy": ["06"], "wave": 3, "zone": ["technozrelost-backend/app/services/"], "status": "done", "startedAt": "2026-09-16T11:07:53+04:00", "finishedAt": "2026-09-16T11:59:21+04:00", "retries": 0, "repairs": 1, "handoffs": 0, "tests": { "passed": 8, "failed": 0 }, "commit": "92590f6", "concerns": ["исполнитель коммитил сам (6f9ebdc) — сверено"] },
    { "id": "09", "title": "P3: публичные реестры", "requirements": ["G04", "G06", "G49", "G59"], "blockedBy": ["02", "05"], "wave": 4, "zone": ["technozrelost-frontend/src/app/"], "status": "done", "startedAt": "2026-09-16T11:49:52+04:00", "finishedAt": "2026-09-16T12:10:18+04:00", "retries": 1, "repairs": 1, "handoffs": 0, "tests": { "passed": 202, "failed": 0 }, "commit": "6fc23b9", "concerns": ["p2-content stale-ассёрт мигрирован отдельным микро-ремонтом"] },
    { "id": "10", "title": "Приёмка: нагрузка, бэкапы, алерты, гейты", "requirements": ["R02", "R03", "G01", "G03", "G16", "G21", "G43", "G44", "G45", "G47", "G48"], "blockedBy": ["04", "07", "08"], "wave": 4, "zone": ["technozrelost-backend/infra/"], "status": "done", "startedAt": "2026-09-16T12:10:18+04:00", "finishedAt": "2026-09-16T12:21:03+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 103, "failed": 0 }, "commit": "2f072cd", "concerns": [] }
  ],
  "singlePass": null,
  "tests": { "frontendPassed": 237, "frontendFailed": 0, "ruff": "pass", "backend": "blocked: test PostgreSQL unavailable", "build": "blocked: Turbopack process/port permission", "mypy": "blocked: Python 3.12 type syntax under current runtime" },
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "OPENCODE_API_KEY", "LLM_API_BASE", "LLM_MODEL"] },
  "additions": [],
  "coverage": {
    "firstPassFindings": 10,
    "fixed": 9,
    "recheckFindings": 0,
    "status": "pass",
    "extra": 5,
    "extraNote": "G2 independent: missing 4 (3 измерения уже отвечены в интервью — зафиксированы как факты; награды — покрытие было, формулировку усилил), half-covered 3 (12 мес, перечень ПДн, папка ГОСТов — дописано); in-spec-not-in-brief 5 — всё привязано к родителям G14/G39/G46/G50/G53/G54/G58, вырезать нечего"
  },
  "concerns": [
    "Предыдущая оценка мощностей не опиралась на ответы пользователя и не считается подтверждённой",
    "Публичная обработка реальных ПДн заявлена до утверждения обязательных документов; фактическая публикация требует отдельного юридического гейта",
    "Пароль root был опубликован в переписке; удалённое использование заблокировано 2026-09-16 отключением PasswordAuthentication, но сам пароль всё ещё следует сменить в Beget",
    "Файл доступов в worktree содержит пароль в открытом виде и не в git; не коммитить, удалить после ротации",
    "Исполнители 07/08 закоммитили сами (3710a44, 6f9ebdc) до ревью — состав коммитов сверен со scope тасков, ревью шли по тому же содержимому; дальше в промптах явный запрет коммитов"
  ],
  "reviewers": { "manifestSpec": null, "craft": null },
  "blind": {
    "status": "partial",
    "agreed": ["public production", "HTTPS", "single-node readiness", "frontend tests", "Ruff"],
    "drift": ["matching enabled although brief deferred it"],
    "unknown": ["SSH hardening", "authorized role flows", "live AI/RAG", "backup freshness and restore", "Telegram delivery", "load thresholds"]
  }
}
