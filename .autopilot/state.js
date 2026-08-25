window.STATE =
{
  "slug": "deploy-readiness-audit",
  "dir": "2026-08-25-deploy-readiness-audit--wip",
  "title": "Ревью и подготовка платформы «Технозрелость» к деплою (B2G)",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-08-25-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-08-25T09:50:59+04:00",
  "updatedAt": "2026-08-25T11:05:00+04:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-08-25T09:50:59+04:00",
      "finishedAt": "2026-08-25T09:53:10+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-08-25T09:53:10+04:00",
      "finishedAt": "2026-08-25T09:59:30+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-08-25T09:59:30+04:00",
      "finishedAt": "2026-08-25T09:59:30+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-08-25T10:01:12+04:00",
      "finishedAt": "2026-08-25T10:06:40+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-08-25T10:06:40+04:00",
      "finishedAt": "2026-08-25T10:10:41+04:00",
      "note": "6 тасков, ярус T2"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-08-25T10:27:41+04:00",
      "note": "2 из 6 тасков готовы; волна 2 запускается"
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
    "total": 12,
    "done": 7,
    "inTicket": 5,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Зелёная база на актуальной main",
      "requirements": [
        "R03",
        "R06",
        "R10",
        "R02"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "technozrelost-backend/app",
        "technozrelost-backend/tests",
        "technozrelost-frontend/src"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-08-25T10:27:41+04:00",
      "finishedAt": "2026-08-25T11:05:00+04:00",
      "tests": {
        "passed": 211,
        "failed": 0
      },
      "commit": "491cf98"
    },
    {
      "id": "02",
      "title": "Гигиена репозитория и карта версий",
      "requirements": [
        "R09",
        "R11"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "корень репо",
        "КОД MVP 0",
        "friday-release-candidate",
        "new-front",
        ".scratch",
        ".worktrees",
        ".gitignore"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-08-25T10:27:41+04:00",
      "finishedAt": "2026-08-25T11:05:00+04:00",
      "tests": null,
      "commit": "0e612c9"
    },
    {
      "id": "03",
      "title": "Безопасность фронтенда, секреты и история",
      "requirements": [
        "R05",
        "R11"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "technozrelost-frontend/src",
        "next.config.ts",
        ".github",
        "git-history-scan"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "04",
      "title": "Безопасность бэкенда",
      "requirements": [
        "R05"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "technozrelost-backend/app",
        "technozrelost-backend/tests"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "05",
      "title": "Инфраструктура: устойчивость и прод-контур локально",
      "requirements": [
        "R07",
        "R04"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "technozrelost-backend/infra"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "06",
      "title": "Производительность",
      "requirements": [
        "R08",
        "R04"
      ],
      "blockedBy": [
        "04",
        "05"
      ],
      "wave": 3,
      "zone": [
        "technozrelost-backend/app (запросы)",
        "alembic",
        "technozrelost-frontend/src"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 211,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "g2": "0 пропусков, 0 наполовину; 15 пунктов спеки сверх брифа — все R#.n-углубления и крафт, приняты"
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": null
}
