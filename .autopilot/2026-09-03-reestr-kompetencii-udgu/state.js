window.STATE =
{
  "slug": "reestr-kompetencii-udgu",
  "dir": "2026-09-03-reestr-kompetencii-udgu",
  "title": "Реестр компетенций УдГУ — формат выгрузки для реестра потенциала УР",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-03-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.claude/skills/autopilot",
  "startedAt": "2026-09-03T08:51:35+04:00",
  "updatedAt": "2026-09-03T09:41:48+04:00",
  "tests": {
    "passed": 25,
    "failed": 0
  },
  "finishedAt": "2026-09-03T09:41:48+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-03T08:51:35+04:00",
      "finishedAt": "2026-09-03T08:52:10+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-03T08:52:10+04:00",
      "finishedAt": "2026-09-03T08:53:05+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-03T08:53:05+04:00",
      "finishedAt": "2026-09-03T09:00:06+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-03T09:00:06+04:00",
      "finishedAt": "2026-09-03T09:05:12+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-03T09:05:12+04:00",
      "finishedAt": "2026-09-03T09:10:45+04:00",
      "note": "4 таска, ярус T2, 3 волны (1+2+1)"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-03T09:10:45+04:00",
      "finishedAt": "2026-09-03T09:35:10+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-03T09:35:10+04:00",
      "finishedAt": "2026-09-03T09:35:15+04:00",
      "note": "проверено 4 из 4"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-09-03T09:35:15+04:00",
      "finishedAt": "2026-09-03T09:41:48+04:00"
    }
  ],
  "requirements": {
    "total": 25,
    "done": 25,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Каркас и JSON-схема",
      "requirements": ["R01", "R19", "R20", "R24"],
      "blockedBy": [],
      "wave": 1,
      "zone": ["technozrelost-backend/docs/udgu_template", "technozrelost-backend/scripts/udgu_ingest"],
      "status": "done",
      "startedAt": "2026-09-03T09:11:00+04:00",
      "finishedAt": "2026-09-03T09:12:15+04:00",
      "tests": {
        "passed": 4,
        "failed": 0
      },
      "commit": "20d04b7"
    },
    {
      "id": "02",
      "title": "Шаблон Excel и ТЗ для УдГУ",
      "requirements": ["R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11", "R12", "R13", "R23", "R25", "R17"],
      "blockedBy": ["01"],
      "wave": 2,
      "zone": ["technozrelost-backend/docs/udgu_template"],
      "status": "done",
      "startedAt": "2026-09-03T09:12:30+04:00",
      "finishedAt": "2026-09-03T09:28:15+04:00",
      "tests": {
        "passed": 5,
        "failed": 0
      },
      "commit": "ec4979c"
    },
    {
      "id": "03",
      "title": "Пайплайн ingest core",
      "requirements": ["R14", "R15", "R22", "R19", "R01"],
      "blockedBy": ["01"],
      "wave": 2,
      "zone": ["technozrelost-backend/scripts/udgu_ingest"],
      "status": "done",
      "startedAt": "2026-09-03T09:12:30+04:00",
      "finishedAt": "2026-09-03T09:28:40+04:00",
      "tests": {
        "passed": 10,
        "failed": 0
      },
      "commit": "0401d83"
    },
    {
      "id": "04",
      "title": "Отчёты, валидация, маппинг и финальная полировка",
      "requirements": ["R16", "R17", "R18", "R21", "R24", "R20", "R04"],
      "blockedBy": ["02", "03"],
      "wave": 3,
      "zone": ["technozrelost-backend/scripts/udgu_ingest", "technozrelost-backend/docs/udgu_template", "technozrelost-backend/tests"],
      "status": "done",
      "startedAt": "2026-09-03T09:28:45+04:00",
      "finishedAt": "2026-09-03T09:35:10+04:00",
      "tests": {
        "passed": 6,
        "failed": 0
      },
      "commit": "9d1f822"
    }
  ],
  "singlePass": null,
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
    "extra": 10,
    "extraNote": "EXTRA — легитимные R##.n углубления, не свободные A"
  },
  "blind": {
    "status": "pass",
    "summary": "10/11 реализовано, 1 частично: обработка на стороне ЦНТР — CLI нормализует в udgu_import.json, но без заливки в БД (ожидаемо, вне рамок spec). Запуск примера ZIP → 25 passed, ingest 0.",
    "open": [
      "R15/R22 частично: udgu_import.json готовится, но не появляется в реестре платформы без ручной верификации (spec §Вне рамок — прямая заливка отложена)"
    ]
  }
}
