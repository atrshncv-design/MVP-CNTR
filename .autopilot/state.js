window.STATE =
{
  "slug": "hardcode-audit",
  "dir": "2026-09-04-hardcode-audit",
  "title": "Аудит хардкода платформы и ранжирование риска для продакшена",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": "2026-09-04-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.claude/skills/autopilot",
  "startedAt": "2026-09-04T08:49:34+04:00",
  "updatedAt": "2026-09-04T08:49:44+04:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-04T08:49:34+04:00",
      "finishedAt": "2026-09-04T08:49:44+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-04T08:49:44+04:00",
      "finishedAt": "2026-09-04T08:51:00+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-04T08:51:00+04:00",
      "finishedAt": "2026-09-04T08:53:00+04:00",
      "note": "1 вопрос: только отчёт без правок"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-04T08:53:00+04:00",
      "finishedAt": "2026-09-04T09:00:00+04:00",
      "note": "G2 pass: 0 missing, 8 extra легитимны"
    },
    {
      "id": "plan",
      "status": "skipped",
      "startedAt": "2026-09-04T09:00:00+04:00",
      "finishedAt": "2026-09-04T09:02:00+04:00",
      "note": "ярус T0 — без разбивки на таски"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-04T09:02:00+04:00",
      "finishedAt": "2026-09-04T09:10:00+04:00",
      "note": "ярус T0 — сканер + отчёт, без разбивки"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-04T09:10:00+04:00",
      "finishedAt": "2026-09-04T09:12:00+04:00",
      "note": "проверено inline T0: чисто"
    },
    {
      "id": "final",
      "status": "active",
      "startedAt": "2026-09-04T09:12:00+04:00"
    }
  ],
  "requirements": {
    "total": 7,
    "done": 7,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [],
  "singlePass": null,
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "firstPassFindings": 0,
    "fixed": 0,
    "recheckFindings": 0,
    "status": "pass",
    "extra": 8,
    "extraNote": "EXTRA — легитимные R##.n углубления + G-решение (только отчёт), свободных A нет"
  },
  "blind": null
}
