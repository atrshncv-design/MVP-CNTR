window.STATE =
{
  "slug": "m2-p2-hardening",
  "dir": "2026-08-29-m2-p2-hardening",
  "title": "M2 — P2 харденинг 27 пунктов (август)",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-08-29-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-08-29T10:11:15+04:00",
  "updatedAt": "2026-08-29T10:55:00+04:00",
  "finishedAt": "2026-08-29T10:55:00+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-08-29T10:11:15+04:00",
      "finishedAt": "2026-08-29T10:15:00+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-08-29T10:15:00+04:00",
      "finishedAt": "2026-08-29T10:20:00+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-08-29T10:20:00+04:00",
      "finishedAt": "2026-08-29T10:20:00+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-08-29T10:20:00+04:00",
      "finishedAt": "2026-08-29T10:25:00+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-08-29T10:25:00+04:00",
      "finishedAt": "2026-08-29T10:30:00+04:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-08-29T10:30:00+04:00",
      "finishedAt": "2026-08-29T10:55:00+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-08-29T10:55:00+04:00",
      "finishedAt": "2026-08-29T10:55:00+04:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-08-29T10:55:00+04:00",
      "finishedAt": "2026-08-29T10:55:00+04:00"
    }
  ],
  "requirements": {
    "total": 28,
    "done": 28,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Токены/файлы (N-09..12)",
      "requirements": [
        "R02",
        "R03",
        "R04",
        "R05"
      ],
      "status": "done",
      "wave": 1,
      "startedAt": "2026-08-29T10:35:00+04:00",
      "finishedAt": "2026-08-29T10:50:00+04:00",
      "tests": {
        "passed": 347,
        "failed": 0
      },
      "commit": "4c92569"
    },
    {
      "id": "02",
      "title": "Комменты/файлы/опросник/зависимости (N-13..17)",
      "requirements": [
        "R06",
        "R07",
        "R08",
        "R09",
        "R10"
      ],
      "status": "done",
      "wave": 1,
      "startedAt": "2026-08-29T10:35:00+04:00",
      "finishedAt": "2026-08-29T10:50:00+04:00",
      "tests": {
        "passed": 347,
        "failed": 0
      },
      "commit": "cb40c69"
    },
    {
      "id": "03",
      "title": "CSP (FE-05,06)",
      "requirements": [
        "R11",
        "R12"
      ],
      "status": "done",
      "wave": 1,
      "startedAt": "2026-08-29T10:35:00+04:00",
      "finishedAt": "2026-08-29T10:50:00+04:00",
      "tests": {
        "passed": 347,
        "failed": 0
      },
      "commit": "0e85e50"
    },
    {
      "id": "04",
      "title": "Инфра P2 (INF-10..20)",
      "requirements": [
        "R13",
        "R14",
        "R15",
        "R16",
        "R17",
        "R18",
        "R19",
        "R20",
        "R21"
      ],
      "status": "done",
      "wave": 1,
      "startedAt": "2026-08-29T10:45:00+04:00",
      "finishedAt": "2026-08-29T10:50:00+04:00",
      "tests": {
        "passed": 347,
        "failed": 0
      },
      "commit": "11bc1c6"
    },
    {
      "id": "05",
      "title": "Perf P2 (P-09..16)",
      "requirements": [
        "R22",
        "R23",
        "R24",
        "R25",
        "R26",
        "R27",
        "R28"
      ],
      "status": "done",
      "wave": 2,
      "blockedBy": [
        "01"
      ],
      "startedAt": "2026-08-29T10:45:00+04:00",
      "finishedAt": "2026-08-29T10:50:00+04:00",
      "tests": {
        "passed": 347,
        "failed": 0
      },
      "commit": "5542c0d"
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
  "blind": {
    "status": "pass",
    "summary": "M2 P2 27 done 5 tickets DONE, M1 24 done, de-dupe GO, P2 гигиена закрыта август"
  }
}
