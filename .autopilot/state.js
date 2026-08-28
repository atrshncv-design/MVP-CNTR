window.STATE =
{
  "slug": "m1-5k-stabilization",
  "dir": "2026-08-28-m1-5k-stabilization--wip",
  "title": "M1 — Стабилизация 5К (24 P1) + дедуп старых тикетов",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-08-28-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-08-28T18:52:31+04:00",
  "updatedAt": "2026-08-28T19:10:00+04:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-08-28T18:52:31+04:00",
      "finishedAt": "2026-08-28T18:55:00+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-08-28T18:55:00+04:00",
      "finishedAt": "2026-08-28T18:58:00+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-08-28T18:58:00+04:00",
      "finishedAt": "2026-08-28T18:58:00+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-08-28T18:58:00+04:00",
      "finishedAt": "2026-08-28T19:00:00+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-08-28T19:00:00+04:00",
      "finishedAt": "2026-08-28T19:05:00+04:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-08-28T19:05:00+04:00"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 24,
    "done": 0,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "LLM-гейтвей (N-05)",
      "requirements": [
        "R03"
      ],
      "status": "in-progress",
      "wave": 1,
      "startedAt": "2026-08-28T19:10:00+04:00"
    },
    {
      "id": "02",
      "title": "Throttle/bcrypt/SSE/Scheduler (N-07,N-08,Q-01,P-02,P-03,P-04,N-03)",
      "requirements": [
        "R04",
        "R05",
        "R06",
        "R07",
        "R08",
        "R09",
        "R10"
      ],
      "status": "in-progress",
      "wave": 1,
      "startedAt": "2026-08-28T19:10:00+04:00"
    },
    {
      "id": "03",
      "title": "Frontend auth + audit (FE-03,FE-04)",
      "requirements": [
        "R11",
        "R12"
      ],
      "status": "in-progress",
      "wave": 1,
      "startedAt": "2026-08-28T19:10:00+04:00"
    },
    {
      "id": "04",
      "title": "Индексы и пагинации 5К 20 (P-05,P-06,P-07,P-08)",
      "requirements": [
        "R13",
        "R14",
        "R15",
        "R16"
      ],
      "status": "pending",
      "wave": 1
    },
    {
      "id": "05",
      "title": "Инфра лимиты/логи/nginx/DR (INF-08,09,12,13,N-18)",
      "requirements": [
        "R17",
        "R18",
        "R19",
        "R20",
        "R21"
      ],
      "status": "pending",
      "wave": 1
    },
    {
      "id": "06",
      "title": "RAG контур + мэтчинг + админка + доки (R22,R23,R24)",
      "requirements": [
        "R22",
        "R23",
        "R24"
      ],
      "status": "pending",
      "wave": 2,
      "blockedBy": [
        "04"
      ]
    },
    {
      "id": "07",
      "title": "Дедуп/ломаная логика",
      "requirements": [
        "R01",
        "R02"
      ],
      "status": "pending",
      "wave": 2,
      "blockedBy": [
        "01",
        "02",
        "03",
        "04",
        "05",
        "06"
      ]
    }
  ],
  "singlePass": null,
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": null,
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": null
}
