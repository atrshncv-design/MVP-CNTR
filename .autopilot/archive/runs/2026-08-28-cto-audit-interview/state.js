window.STATE =
{
  "slug": "cto-audit-interview",
  "dir": "2026-08-28-cto-audit-interview--wip",
  "title": "CTO аудит и глубинное интервью — платформа Технозрелость",
  "mode": "interview",
  "depth": "deep",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-08-28-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-08-28T10:03:42+04:00",
  "updatedAt": "2026-08-28T14:35:00+04:00",
  "finishedAt": "2026-08-28T14:35:00+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-08-28T10:03:42+04:00",
      "finishedAt": "2026-08-28T10:04:30+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-08-28T10:04:30+04:00",
      "finishedAt": "2026-08-28T10:05:00+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-08-28T10:05:00+04:00",
      "finishedAt": "2026-08-28T14:20:00+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-08-28T14:20:00+04:00",
      "finishedAt": "2026-08-28T14:25:00+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-08-28T14:25:00+04:00",
      "finishedAt": "2026-08-28T14:30:00+04:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-08-28T14:30:00+04:00",
      "finishedAt": "2026-08-28T14:35:00+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-08-28T14:35:00+04:00",
      "finishedAt": "2026-08-28T14:35:00+04:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-08-28T14:35:00+04:00",
      "finishedAt": "2026-08-28T14:35:00+04:00"
    }
  ],
  "requirements": {
    "total": 27,
    "done": 27,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Смета бюджета ЦНТР 5К/10К с разбивкой по контейнерам",
      "requirements": [
        "G01"
      ],
      "status": "pending",
      "wave": 1
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 0,
    "failed": 0,
    "scope": "интервью-прогон, код не менялся, тесты не гонялись"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": [
      "TELEGRAM_BOT_TOKEN",
      "BACKUP_OFFSITE_REMOTE",
      "YANDEX_CLIENT_ID",
      "VK_CLIENT_ID"
    ]
  },
  "additions": [],
  "coverage": null,
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "status": "drift",
    "summary": "интервью 14 ответов зафиксированы, 11 артефактов в Большое интервью 280826, смета вынесена в тикет 01 для сметчика; кодовые правки отложены до M1"
  }
}
