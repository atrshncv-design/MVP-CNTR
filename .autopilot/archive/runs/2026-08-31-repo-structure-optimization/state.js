window.STATE =
{
  "slug": "repo-structure-optimization",
  "dir": "2026-08-31-repo-structure-optimization",
  "title": "Оптимизация структуры директории без удаления рабочих файлов",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-08-31-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.claude/skills/autopilot",
  "startedAt": "2026-08-31T09:50:46+04:00",
  "updatedAt": "2026-08-31T10:10:00+04:00",
  "finishedAt": "2026-08-31T10:10:00+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-08-31T09:50:46+04:00",
      "finishedAt": "2026-08-31T09:51:30+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-08-31T09:51:00+04:00",
      "finishedAt": "2026-08-31T09:51:30+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-08-31T09:51:30+04:00",
      "finishedAt": "2026-08-31T09:52:00+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-08-31T09:52:00+04:00",
      "finishedAt": "2026-08-31T09:55:00+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-08-31T09:55:00+04:00",
      "finishedAt": "2026-08-31T09:56:00+04:00",
      "note": "3 таска, ярус T1"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-08-31T09:56:00+04:00",
      "finishedAt": "2026-08-31T10:10:00+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-08-31T10:10:00+04:00",
      "finishedAt": "2026-08-31T10:10:00+04:00",
      "note": "проверено 3 из 3"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-08-31T10:10:00+04:00",
      "finishedAt": "2026-08-31T10:10:00+04:00"
    }
  ],
  "requirements": {
    "total": 12,
    "done": 12,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Фикс .gitignore + дубли документации",
      "requirements": [
        "R01",
        "R03",
        "R04",
        "R05",
        "R08",
        "R09i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        ".gitignore",
        "docs/docs",
        "technozrelost-frontend/DESIGN.md"
      ],
      "status": "done",
      "startedAt": "2026-08-31T09:56:00+04:00",
      "finishedAt": "2026-08-31T10:00:00+04:00",
      "commit": "47cd50c",
      "tests": {
        "passed": 362,
        "failed": 0
      }
    },
    {
      "id": "02",
      "title": "Локальная очистка кэшей + дедуп reports",
      "requirements": [
        "R01",
        "R04",
        "R05",
        "R06",
        "R09"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "technozrelost-frontend/.next",
        "technozrelost-backend/reports"
      ],
      "status": "done",
      "startedAt": "2026-08-31T10:00:00+04:00",
      "finishedAt": "2026-08-31T10:05:00+04:00",
      "tests": {
        "passed": 0,
        "failed": 0
      },
      "commit": "no-commit: local-only ignored cache + backend/reports deduplication"
    },
    {
      "id": "03",
      "title": "Гигиена веток/крупные файлы + финальный gate",
      "requirements": [
        "R01",
        "R02",
        "R07",
        "R08",
        "R11"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 3,
      "zone": [
        "docs/version-map.md",
        "docs/adr"
      ],
      "status": "done",
      "startedAt": "2026-08-31T10:05:00+04:00",
      "finishedAt": "2026-08-31T10:10:00+04:00",
      "commit": "c16724b",
      "tests": {
        "passed": 362,
        "failed": 0
      }
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 362,
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
    "summary": "Слепая сверка: 12/12 требований покрыты, рабочие файлы не удалены, сборка зелёная",
    "open": []
  }
}