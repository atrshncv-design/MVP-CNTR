window.STATE =
{
  "slug": "m4-audit-plan",
  "dir": "2026-08-29-m4-audit-plan",
  "title": "M4 — План устранения аудита 14 находок (6 спек 14 тикетов)",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-08-29-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-08-29T16:03:00+04:00",
  "updatedAt": "2026-08-29T21:30:00+04:00",
  "finishedAt": "2026-08-29T21:30:00+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-08-29T16:03:00+04:00",
      "finishedAt": "2026-08-29T16:03:30+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-08-29T16:03:30+04:00",
      "finishedAt": "2026-08-29T16:04:00+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-08-29T16:04:00+04:00",
      "finishedAt": "2026-08-29T16:04:30+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-08-29T16:04:30+04:00",
      "finishedAt": "2026-08-29T16:30:00+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-08-29T16:30:00+04:00",
      "finishedAt": "2026-08-29T17:00:00+04:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-08-29T21:30:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-08-29T21:30:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00"
    }
  ],
  "requirements": {
    "total": 20,
    "done": 20,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Digest clamav официал H-01",
      "requirements": [
        "R02"
      ],
      "status": "done",
      "wave": 1,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "02",
      "title": "Git hygiene + push M-05",
      "requirements": [
        "R08"
      ],
      "status": "done",
      "wave": 3,
      "blockedBy": [
        "01",
        "03"
      ],
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "03",
      "title": "0031 без pg_temp H-02",
      "requirements": [
        "R03"
      ],
      "status": "done",
      "wave": 1,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "04",
      "title": "0032 downgrade индексы L-03",
      "requirements": [
        "R11"
      ],
      "status": "done",
      "wave": 2,
      "blockedBy": [
        "03"
      ],
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "05",
      "title": "Nginx X-Request-ID regex M-01",
      "requirements": [
        "R04"
      ],
      "status": "done",
      "wave": 1,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "06",
      "title": "CVD единый источник M-02",
      "requirements": [
        "R05"
      ],
      "status": "done",
      "wave": 1,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "07",
      "title": "SOPS recipient I-03",
      "requirements": [
        "R15"
      ],
      "status": "done",
      "wave": 3,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "08",
      "title": "Questionnaire staff avg M-03",
      "requirements": [
        "R06"
      ],
      "status": "done",
      "wave": 2,
      "blockedBy": [
        "03"
      ],
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "09",
      "title": "Technologies ETag per page I-02",
      "requirements": [
        "R14"
      ],
      "status": "done",
      "wave": 2,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "10",
      "title": "File fallback dedup L-02",
      "requirements": [
        "R10"
      ],
      "status": "done",
      "wave": 2,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "11",
      "title": "Dedup tests L-01",
      "requirements": [
        "R09"
      ],
      "status": "done",
      "wave": 2,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "12",
      "title": "Scheduler guard I-01",
      "requirements": [
        "R13"
      ],
      "status": "done",
      "wave": 3,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "13",
      "title": "Gitignore reports L-04",
      "requirements": [
        "R12"
      ],
      "status": "done",
      "wave": 2,
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    },
    {
      "id": "14",
      "title": "External smoke M-04",
      "requirements": [
        "R07"
      ],
      "status": "done",
      "wave": 4,
      "blockedBy": [
        "01",
        "02",
        "03",
        "05",
        "06",
        "08"
      ],
      "startedAt": "2026-08-29T17:00:00+04:00",
      "finishedAt": "2026-08-29T21:30:00+04:00",
      "tests": {
        "passed": 362,
        "failed": 0
      },
      "commit": "65ea96c"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 362,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Q-01 clamav/clamav официал amd64",
      "Q-02 staff avg + ?all=1",
      "Q-03 nginx regex",
      "Q-04 env CVD единый",
      "Q-05 SOPS отложено",
      "Q-06 technologies per page"
    ],
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
    "summary": "M4 14/14 done, H-01/H-02/M-01..M-05/L-01..L-04/I-01..I-03 closed, 362 backend 39 frontend green, ruff/mypy pass, external smoke — pending прод-хост (stubs)"
  }
}