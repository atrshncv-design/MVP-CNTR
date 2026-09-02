window.STATE =
{
  "slug": "frontend-lk-unification",
  "dir": "2026-09-01-frontend-lk-unification",
  "title": "Унификация frontend — ЛК 8 ролей, реестры, карточка УГТ, matching",
  "mode": "interview",
  "depth": "deep",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-01-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.claude/skills/autopilot",
  "startedAt": "2026-09-01T08:34:51+04:00",
  "updatedAt": "2026-09-01T11:37:20.756668+04:00",
  "finishedAt": "2026-09-01T11:37:20.756668+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-01T08:34:51+04:00",
      "finishedAt": "2026-09-01T08:35:00+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-01T08:35:00+04:00",
      "finishedAt": "2026-09-01T10:15:00+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-01T10:15:00+04:00",
      "finishedAt": "2026-09-01T10:20:00+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-01T10:20:00+04:00",
      "finishedAt": "2026-09-01T10:20:28+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-01T10:20:28+04:00",
      "finishedAt": "2026-09-01T10:20:28+04:00",
      "note": "8 тасков, ярус T2, 3 волны"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-01T10:24:59.695270+04:00",
      "finishedAt": "2026-09-01T11:36:41.740834+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-01T11:36:41.740834+04:00",
      "finishedAt": "2026-09-01T11:36:41.740834+04:00",
      "note": "проверено 8 из 8"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-09-01T11:36:41.740834+04:00",
      "finishedAt": "2026-09-01T11:37:20.756668+04:00"
    }
  ],
  "requirements": {
    "total": 92,
    "done": 92,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "P0 фундамент: типы, единый api-client, UI-база",
      "requirements": [
        "R27",
        "R31",
        "R32",
        "G14",
        "G30"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/lib/",
        "src/components/ui/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-01T10:24:59.695270+04:00",
      "finishedAt": "2026-09-01T10:39:08.537440+04:00",
      "tests": {
        "passed": 39,
        "failed": 0
      },
      "commit": "feat-01-foundation"
    },
    {
      "id": "02",
      "title": "Унифицированный shell 8 ЛК (топбар+табы)",
      "requirements": [
        "R02",
        "R15",
        "G01",
        "G05",
        "G12"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/features/dashboard/",
        "src/app/dashboard/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-01T10:39:08.537440+04:00",
      "finishedAt": "2026-09-01T11:22:14.502836+04:00",
      "tests": {
        "passed": 58,
        "failed": 0
      },
      "commit": "feat-02"
    },
    {
      "id": "03",
      "title": "Карточка проекта 15 блоков + УГТ-линия",
      "requirements": [
        "R05",
        "R18",
        "G17",
        "G18",
        "G20",
        "G21"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/features/project/",
        "src/app/dashboard/project/[id]/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-01T10:39:08.537440+04:00",
      "finishedAt": "2026-09-01T11:22:14.502836+04:00",
      "tests": {
        "passed": 58,
        "failed": 0
      },
      "commit": "feat-03"
    },
    {
      "id": "04",
      "title": "Реестры единый стандарт (карточки, фильтры, realtime)",
      "requirements": [
        "R06",
        "R20",
        "R21",
        "G24",
        "G26",
        "G45"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/features/registry/",
        "src/app/dashboard/projects/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-01T10:39:08.537440+04:00",
      "finishedAt": "2026-09-01T11:22:14.502836+04:00",
      "tests": {
        "passed": 58,
        "failed": 0
      },
      "commit": "feat-04"
    },
    {
      "id": "05",
      "title": "Matching отдельный режим (ИИ без ПДн)",
      "requirements": [
        "R07",
        "R23",
        "G27",
        "G57"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/features/matching/",
        "src/app/dashboard/matching/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-01T10:39:08.537440+04:00",
      "finishedAt": "2026-09-01T11:22:14.502836+04:00",
      "tests": {
        "passed": 58,
        "failed": 0
      },
      "commit": "feat-05"
    },
    {
      "id": "06",
      "title": "Чек-лист ГОСТ доков + шаблоны + ИИ-консультант",
      "requirements": [
        "G16",
        "G20",
        "G29",
        "G39"
      ],
      "blockedBy": [
        "01",
        "03"
      ],
      "wave": 3,
      "zone": [
        "src/features/docs/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-01T11:22:14.502836+04:00",
      "finishedAt": "2026-09-01T11:36:41.740834+04:00",
      "tests": {
        "passed": 58,
        "failed": 0
      },
      "commit": "feat-06"
    },
    {
      "id": "07",
      "title": "Уведомления + сессия модалка + верификация",
      "requirements": [
        "G43",
        "G41",
        "G54"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/features/notifications/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-01T10:39:08.537440+04:00",
      "finishedAt": "2026-09-01T11:22:14.502836+04:00",
      "tests": {
        "passed": 58,
        "failed": 0
      },
      "commit": "feat-07"
    },
    {
      "id": "08",
      "title": "Аналитика ЦНТР + hard-gate бейдж",
      "requirements": [
        "G34",
        "G50",
        "G38"
      ],
      "blockedBy": [
        "01",
        "02",
        "04"
      ],
      "wave": 3,
      "zone": [
        "src/features/analytics/",
        "src/app/dashboard/cntr_admin/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-09-01T11:22:14.502836+04:00",
      "finishedAt": "2026-09-01T11:36:41.740834+04:00",
      "tests": {
        "passed": 58,
        "failed": 0
      },
      "commit": "feat-08"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 58,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "firstPassFindings": 5,
    "fixed": 5,
    "recheckFindings": 0,
    "status": "pass"
  },
  "blind": {
    "status": "pass",
    "summary": "Слепая сверка 92/92 требований покрыты, без ПДн для LLM, 8 ЛК, matching через ЦНТР",
    "open": []
  }
}