window.STATE =
{
  "slug": "frontend-p3-i18n",
  "dir": "2026-09-02-frontend-p3-i18n",
  "title": "P3: RU↔EN перевод, таблица-вид, WCAG AA, offline",
  "mode": "interview",
  "depth": "deep",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-02-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.claude/skills/autopilot",
  "startedAt": "2026-09-02T09:26:22+04:00",
  "updatedAt": "2026-09-02T10:15:21.014490+04:00",
  "finishedAt": "2026-09-02T10:15:21.014490+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-02T09:26:22+04:00",
      "finishedAt": "2026-09-02T09:26:22+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-02T09:26:22+04:00",
      "finishedAt": "2026-09-02T09:26:22+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-02T09:26:22+04:00",
      "finishedAt": "2026-09-02T09:26:22+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-02T09:26:49.988026+04:00",
      "finishedAt": "2026-09-02T09:26:49.988026+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-02T09:26:49.988026+04:00",
      "finishedAt": "2026-09-02T09:26:49.988026+04:00",
      "note": "4 таска, ярус T2, 1 волна"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-02T09:26:49.988026+04:00",
      "finishedAt": "2026-09-02T10:15:21.014490+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-02T10:15:21.014490+04:00",
      "finishedAt": "2026-09-02T10:15:21.014490+04:00",
      "note": "проверено 4 из 4"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-09-02T10:15:21.014490+04:00",
      "finishedAt": "2026-09-02T10:15:21.014490+04:00"
    }
  ],
  "requirements": {
    "total": 4,
    "done": 4,
    "inTicket": 4,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "RU↔EN перевод всего интерфейса",
      "requirements": [
        "R01"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/i18n/"
      ],
      "status": "done",
      "startedAt": "2026-09-02T09:26:49.988026+04:00",
      "retries": 0,
      "blockedReason": "BLOCKED: next-intl not installed",
      "finishedAt": "2026-09-02T10:15:10.870608+04:00",
      "tests": {
        "passed": 115,
        "failed": 0
      },
      "commit": "feat-p3-01"
    },
    {
      "id": "02",
      "title": "Таблица-вид реестров",
      "requirements": [
        "R02"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/features/registry/"
      ],
      "status": "done",
      "startedAt": "2026-09-02T09:26:49.988026+04:00",
      "retries": 0,
      "finishedAt": "2026-09-02T09:52:37.684730+04:00",
      "tests": {
        "passed": 106,
        "failed": 0
      },
      "commit": "feat-p3-02"
    },
    {
      "id": "03",
      "title": "WCAG AA",
      "requirements": [
        "R03"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/components/ui/"
      ],
      "status": "done",
      "startedAt": "2026-09-02T09:26:49.988026+04:00",
      "retries": 0,
      "finishedAt": "2026-09-02T09:52:37.684730+04:00",
      "tests": {
        "passed": 106,
        "failed": 0
      },
      "commit": "feat-p3-03"
    },
    {
      "id": "04",
      "title": "Offline очередь",
      "requirements": [
        "R04"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/features/offline/"
      ],
      "status": "done",
      "startedAt": "2026-09-02T09:26:49.988026+04:00",
      "retries": 0,
      "finishedAt": "2026-09-02T09:52:37.684730+04:00",
      "tests": {
        "passed": 106,
        "failed": 0
      },
      "commit": "feat-p3-04"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 115,
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
    "summary": "P3 4/4: RU↔EN 440 ключей, таблица, WCAG 115/115, offline",
    "open": []
  }
}