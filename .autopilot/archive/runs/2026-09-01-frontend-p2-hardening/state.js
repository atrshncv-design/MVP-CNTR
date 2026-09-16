window.STATE =
{
  "slug": "frontend-p2-hardening",
  "dir": "2026-09-01-frontend-p2-hardening",
  "title": "P2: экспорт, сохранённые фильтры, LLM rerank, КТ 1-4",
  "mode": "interview",
  "depth": "deep",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-02-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.claude/skills/autopilot",
  "startedAt": "2026-09-02T07:59:58+04:00",
  "updatedAt": "2026-09-02T09:12:20.217093+04:00",
  "finishedAt": "2026-09-02T09:12:20.217093+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-02T07:59:58+04:00",
      "finishedAt": "2026-09-02T07:59:58+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-02T07:59:58+04:00",
      "finishedAt": "2026-09-02T07:59:58+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-02T07:59:58+04:00",
      "finishedAt": "2026-09-02T08:26:18.711033+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-02T08:26:18.711033+04:00",
      "finishedAt": "2026-09-02T08:26:18.711033+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-02T08:26:18.711033+04:00",
      "finishedAt": "2026-09-02T08:26:18.711033+04:00",
      "note": "4 таска, ярус T2, 1 волна"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-02T08:26:34.772774+04:00",
      "finishedAt": "2026-09-02T09:12:02.009593+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-02T09:12:02.009593+04:00",
      "finishedAt": "2026-09-02T09:12:02.009593+04:00",
      "note": "проверено 4 из 4"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-09-02T09:12:02.009593+04:00",
      "finishedAt": "2026-09-02T09:12:20.217093+04:00"
    }
  ],
  "requirements": {
    "total": 6,
    "done": 6,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Экспорт XLSX для админа",
      "requirements": [
        "R01"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/features/registry/export/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-02T08:26:34.772774+04:00",
      "finishedAt": "2026-09-02T09:12:02.009593+04:00",
      "tests": {
        "passed": 74,
        "failed": 0
      },
      "commit": "feat-p2-01"
    },
    {
      "id": "02",
      "title": "Сохранённые фильтры без лимита",
      "requirements": [
        "R02"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/features/registry/saved-filters/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-02T08:26:34.772774+04:00",
      "finishedAt": "2026-09-02T09:12:02.009593+04:00",
      "tests": {
        "passed": 74,
        "failed": 0
      },
      "commit": "feat-p2-02"
    },
    {
      "id": "03",
      "title": "LLM rerank matching с fallback",
      "requirements": [
        "R03"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/features/matching/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-02T08:26:34.772774+04:00",
      "finishedAt": "2026-09-02T09:12:02.009593+04:00",
      "tests": {
        "passed": 74,
        "failed": 0
      },
      "commit": "feat-p2-03"
    },
    {
      "id": "04",
      "title": "КТ 1-4 Go/No-Go для аудитора",
      "requirements": [
        "R04",
        "R05"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/features/project/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-02T08:26:34.772774+04:00",
      "finishedAt": "2026-09-02T09:12:02.009593+04:00",
      "tests": {
        "passed": 74,
        "failed": 0
      },
      "commit": "feat-p2-04"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 74,
    "failed": 0
  },
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
    "status": "pass"
  },
  "blind": {
    "status": "pass",
    "summary": "P2 слепая сверка 6/6, XLSX админу, безлимит фильтры, LLM+tuno fallback, КТ 1-4",
    "open": []
  }
}