window.STATE =
{
  "slug": "hardcode-remediation",
  "dir": "2026-09-04-hardcode-remediation",
  "title": "Вынос хардкода по карте аудита — перевод и конфиги",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-04-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.claude/skills/autopilot",
  "startedAt": "2026-09-04T09:52:44+04:00",
  "updatedAt": "2026-09-06T20:06:00+04:00",
  "finishedAt": "2026-09-06T20:06:00+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-04T09:52:44+04:00",
      "finishedAt": "2026-09-04T09:53:00+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-04T09:53:00+04:00",
      "finishedAt": "2026-09-04T09:54:00+04:00",
      "note": "7 требований"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-04T09:54:00+04:00",
      "finishedAt": "2026-09-04T09:58:00+04:00",
      "note": "2 вопроса: объём P0 фронта, чекпоинт"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-04T09:58:00+04:00",
      "finishedAt": "2026-09-04T10:05:00+04:00",
      "note": "G2 pass: мета-находки, резать нечего"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-04T10:05:00+04:00",
      "finishedAt": "2026-09-04T10:03:00+04:00",
      "note": "6 тасков, ярус T2, 6 волн по одной"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-04T10:03:00+04:00",
      "finishedAt": "2026-09-06T20:06:00+04:00",
      "note": "7 из 7 тасков готовы"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-04T10:03:00+04:00",
      "finishedAt": "2026-09-06T20:06:00+04:00",
      "note": "проверено 7 из 7"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-09-06T19:54:00+04:00",
      "finishedAt": "2026-09-06T20:06:00+04:00"
    }
  ],
  "requirements": {
    "total": 7,
    "done": 5,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 2,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Словарный фундамент и контентные данные",
      "requirements": ["R01", "R02", "R03"],
      "blockedBy": [],
      "wave": 1,
      "zone": ["technozrelost-frontend/src/lib/"],
      "status": "done",
      "startedAt": "2026-09-04T10:03:00+04:00",
      "finishedAt": "2026-09-04T10:57:00+04:00",
      "retries": 0,
      "repairs": 2,
      "tests": {
        "passed": 120,
        "failed": 0
      },
      "commit": "423b7f8",
      "concerns": ["спорные EN методологии — списком в отчёте на приёмку", "исполнитель коммитил сам (3 коммита) — дальше запрет в промпте"]
    },
    {
      "id": "02",
      "title": "Экраны проектного контура",
      "requirements": ["R01", "R02"],
      "blockedBy": ["01"],
      "wave": 2,
      "zone": ["technozrelost-frontend/src/features/project/"],
      "status": "done",
      "startedAt": "2026-09-04T10:57:00+04:00",
      "finishedAt": "2026-09-04T11:20:00+04:00",
      "retries": 0,
      "repairs": 2,
      "tests": {
        "passed": 122,
        "failed": 0
      },
      "commit": "8cc65dd",
      "concerns": ["шим validateTags живёт до T06", "бюджет ru-RU принят как есть"]
    },
    {
      "id": "03",
      "title": "Реестр, фильтры и экспорт",
      "requirements": ["R01", "R02", "R03"],
      "blockedBy": ["02"],
      "wave": 3,
      "zone": ["technozrelost-frontend/src/features/registry/"],
      "status": "done",
      "startedAt": "2026-09-04T11:20:00+04:00",
      "finishedAt": "2026-09-04T11:33:00+04:00",
      "retries": 0,
      "tests": {
        "passed": 127,
        "failed": 0
      },
      "commit": "7b7fac5",
      "concerns": []
    },
    {
      "id": "04",
      "title": "Дашборд и общие панели",
      "requirements": ["R01", "R02"],
      "blockedBy": ["03"],
      "wave": 4,
      "zone": ["technozrelost-frontend/src/app/dashboard/"],
      "status": "done",
      "startedAt": "2026-09-04T11:33:00+04:00",
      "finishedAt": "2026-09-06T13:36:00+04:00",
      "retries": 0,
      "repairs": 2,
      "tests": {
        "passed": 135,
        "failed": 0
      },
      "commit": "4734cb9",
      "concerns": []
    },
    {
      "id": "05",
      "title": "Лендинг, вход и остаток",
      "requirements": ["R01", "R02"],
      "blockedBy": ["04"],
      "wave": 5,
      "zone": ["technozrelost-frontend/src/app/"],
      "status": "done",
      "startedAt": "2026-09-06T13:36:00+04:00",
      "finishedAt": "2026-09-06T19:26:00+04:00",
      "retries": 0,
      "repairs": 1,
      "tests": {
        "passed": 148,
        "failed": 0
      },
      "commit": "ae3c98f",
      "concerns": []
    },
    {
      "id": "06",
      "title": "Финальная сверка и сборка",
      "requirements": ["R06i", "R07i"],
      "blockedBy": ["05"],
      "wave": 6,
      "zone": ["technozrelost-frontend/"],
      "status": "done",
      "startedAt": "2026-09-06T19:26:00+04:00",
      "finishedAt": "2026-09-06T19:54:00+04:00",
      "retries": 0,
      "repairs": 2,
      "tests": {
        "passed": 150,
        "failed": 0
      },
      "commit": "4abba8f",
      "concerns": []
    },
    {
      "id": "07",
      "title": "Добор пропущенных строк (слепая приёмка)",
      "requirements": ["R01", "R02"],
      "blockedBy": ["06"],
      "wave": 7,
      "zone": ["technozrelost-frontend/src/"],
      "status": "done",
      "startedAt": "2026-09-06T20:00:00+04:00",
      "finishedAt": "2026-09-06T20:06:00+04:00",
      "retries": 0,
      "repairs": 1,
      "tests": {
        "passed": 151,
        "failed": 0
      },
      "commit": "e5068f0",
      "concerns": []
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
  "coverage": {
    "firstPassFindings": 3,
    "fixed": 0,
    "recheckFindings": 0,
    "status": "pass",
    "extra": 14,
    "extraNote": "3 находки — мета-текст брифа (обсуждение состоялось) и вариант из брифинга; EXTRA — R##.n углубления + G-решения, свободных A нет"
  },
  "blind": {
    "status": "pass",
    "summary": "P0 фронта закрыт: ui-string 1335→73 (остаток — запрещёнка), паритет 2608/2608, сюита 151/151, build проходит, бэкенд не тронут",
    "open": [],
    "drift": "слепая приёмка нашла пропуски P0-3 (фолбэк консультанта, ошибка экспорта, queue/nav/auth) — исправлено таском 07"
  }
}
