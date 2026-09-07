window.STATE =
{
  "slug": "backend-hardcode",
  "dir": "2026-09-07-backend-hardcode",
  "title": "Бэкенд: каталог сообщений API и конфиги из кода",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-09-07-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-09-07T07:54:38+04:00",
  "updatedAt": "2026-09-07T10:11:27+04:00",
  "finishedAt": "2026-09-07T10:11:27+04:00",
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-09-07T07:54:38+04:00", "finishedAt": "2026-09-07T07:55:00+04:00" },
    { "id": "manifest",  "status": "done", "startedAt": "2026-09-07T07:55:00+04:00", "finishedAt": "2026-09-07T07:57:00+04:00", "note": "6 требований" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-09-07T07:57:00+04:00", "finishedAt": "2026-09-07T08:00:00+04:00", "note": "1 вопрос: коды + каталог" },
    { "id": "spec",      "status": "done", "startedAt": "2026-09-07T07:58:00+04:00", "finishedAt": "2026-09-07T08:00:00+04:00", "note": "G2 pass: резать нечего" },
    { "id": "plan",      "status": "done", "startedAt": "2026-09-07T08:00:00+04:00", "finishedAt": "2026-09-07T08:02:00+04:00", "note": "3 таска, ярус T1, цепочка 1-2-3" },
    { "id": "build",     "status": "done", "startedAt": "2026-09-07T08:02:00+04:00", "finishedAt": "2026-09-07T10:00:00+04:00", "note": "3 из 3 тасков готовы" },
    { "id": "review",    "status": "done", "startedAt": "2026-09-07T08:02:00+04:00", "finishedAt": "2026-09-07T10:00:00+04:00", "note": "проверено 3 из 3" },
    { "id": "final",     "status": "done", "startedAt": "2026-09-07T10:00:00+04:00", "finishedAt": "2026-09-07T10:11:00+04:00" }
  ],
  "requirements": {
    "total": 6, "done": 6, "inTicket": 0, "inSpec": 0,
    "placeholder": 0, "deferred": 0, "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Каталог сообщений API",
      "requirements": ["R03"],
      "blockedBy": [],
      "wave": 1,
      "zone": ["technozrelost-backend/app/core/"],
      "status": "done",
      "startedAt": "2026-09-07T08:02:00+04:00",
      "finishedAt": "2026-09-07T08:25:00+04:00",
      "retries": 0, "repairs": 1, "handoffs": 0,
      "tests": { "passed": 397, "failed": 0 },
      "commit": "6acc249",
      "concerns": ["спорные EN готовности — списком на приёмку"]
    },
    {
      "id": "02",
      "title": "Миграция ошибок на каталог",
      "requirements": ["R03"],
      "blockedBy": ["01"],
      "wave": 2,
      "zone": ["technozrelost-backend/app/api/"],
      "status": "done",
      "startedAt": "2026-09-07T08:25:00+04:00",
      "finishedAt": "2026-09-07T09:49:00+04:00",
      "retries": 0, "repairs": 1, "handoffs": 2,
      "tests": { "passed": 403, "failed": 0 },
      "commit": "969f68a",
      "concerns": []
    },
    {
      "id": "03",
      "title": "Конфиги в env и финальная сверка",
      "requirements": ["R01", "R02", "R04", "R05i", "R06i"],
      "blockedBy": ["02"],
      "wave": 3,
      "zone": ["technozrelost-backend/app/core/config.py"],
      "status": "done",
      "startedAt": "2026-09-07T09:49:00+04:00",
      "finishedAt": "2026-09-07T10:00:00+04:00",
      "retries": 0, "repairs": 0, "handoffs": 0,
      "tests": { "passed": 403, "failed": 0 },
      "commit": "9ffc9c2",
      "concerns": []
    }
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
    "extra": 14,
    "extraNote": "EXTRA — легитимные R##.n углубления + G-решение (коды + каталог), свободных A нет"
  },
  "concerns": [],
  "reviewers": { "manifestSpec": "ses_f85f06e79ffeQGcAeWJsyawZ1N", "craft": "ses_f85f06e69ffe7q1KPdaKt15JeC" },
  "blind": {
    "status": "pass",
    "summary": "6/6 реализовано живьём: health/ready, каталог ru/en, коды в заголовке, конфиги в env",
    "open": []
  }
}
