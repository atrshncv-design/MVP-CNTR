window.STATE =
{
  "slug": "server-infrastructure-requirements",
  "dir": "2026-08-30-server-infrastructure-requirements",
  "title": "Требования к серверной инфраструктуре платформы «Технозрелость»",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-08-30-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-08-30T11:07:17+04:00",
  "updatedAt": "2026-08-30T18:37:46+04:00",
  "finishedAt": "2026-08-30T18:37:46+04:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-08-30T11:07:17+04:00",
      "finishedAt": "2026-08-30T11:08:28+04:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-08-30T11:08:28+04:00",
      "finishedAt": "2026-08-30T11:12:22+04:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-08-30T11:12:22+04:00",
      "finishedAt": "2026-08-30T11:32:13+04:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-08-30T11:32:13+04:00",
      "finishedAt": "2026-08-30T11:42:46+04:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-08-30T11:42:46+04:00",
      "finishedAt": "2026-08-30T11:44:24+04:00",
      "note": "3 таска, ярус T1"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-08-30T11:44:24+04:00",
      "finishedAt": "2026-08-30T18:32:20+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-08-30T17:39:05+04:00",
      "note": "проверено 2 из 3",
      "finishedAt": "2026-08-30T18:32:20+04:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-08-30T18:32:20+04:00",
      "finishedAt": "2026-08-30T18:37:46+04:00"
    }
  ],
  "requirements": {
    "total": 79,
    "done": 78,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 1,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Архитектура, нагрузка и расчёты",
      "requirements": [
        "R01–R32",
        "R45–R55",
        "R61–R69",
        "G01–G08"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "work/evidence-capacity.md"
      ],
      "status": "done",
      "startedAt": "2026-08-30T17:39:05+04:00",
      "retries": 0,
      "repairs": 2,
      "repairFindings": [
        "Добавить полные поля сценариев и per-service resource matrix",
        "Добавить роли, сценарии, deploy/integrations и ограничения измерений",
        "Убрать лишний вариант размещения и маркировать baseline/assumptions",
        "Исправить backup capacity с WAL и свободным местом",
        "Добавить importance/value частоты CPU по каждому сервису и раздельные подстроки 2/3 серверов внутри категории нескольких серверов"
      ],
      "handoffs": 0,
      "finishedAt": "2026-08-30T18:10:43+04:00",
      "tests": {
        "passed": 15,
        "failed": 0
      },
      "commit": "not-created: docs-only run"
    },
    {
      "id": "02",
      "title": "Оборудование, совместимость и стоимость",
      "requirements": [
        "R33–R44",
        "R56–R58",
        "R60",
        "R62–R68",
        "G07–G10"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "work/hardware-procurement.md"
      ],
      "status": "done",
      "startedAt": "2026-08-30T17:39:05+04:00",
      "retries": 0,
      "repairs": 2,
      "repairFindings": [
        "Удалить неподтверждённую Dell R7625/EPYC 9224 совместимость",
        "Заполнить все обязательные поля 12 конфигураций",
        "Добавить OPEX каждой recommended-конфигурации и воспроизводимый BOM",
        "Подтвердить либо убрать Micron-аналоги без официального источника"
      ],
      "handoffs": 0,
      "finishedAt": "2026-08-30T18:10:43+04:00",
      "tests": {
        "passed": 12,
        "failed": 0
      },
      "commit": "not-created: docs-only run"
    },
    {
      "id": "03",
      "title": "Итоговый отчёт и закупочная спецификация",
      "requirements": [
        "R01–R69",
        "G01–G10"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "docs/СЕРВЕР-ТРЕБОВАНИЯ-2026.md"
      ],
      "status": "done",
      "startedAt": "2026-08-30T18:11:37+04:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "Добавить deploy methods и path:line к absence claims",
        "Добавить total file volume A–D и полную per-service resource matrix",
        "Раскрыть все обязательные поля 12 конфигураций и storage по назначениям",
        "Разбить стоимость каждой recommended A/B/C/D",
        "Добавить трассировку 79 требований",
        "Вернуть шесть placement-категорий и исправить backup BOM минимум до 9,86 TiB usable",
        "Добавить citations строкам 81–84, CPU rationale всем profiles, A-backup cost estimate и убрать двойной подсчёт 20% backup reserve"
      ],
      "handoffs": 0,
      "finishedAt": "2026-08-30T18:32:20+04:00",
      "tests": {
        "passed": 15,
        "failed": 0
      },
      "commit": "not-created: repository policy"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 42,
    "failed": 0
  },
  "debt": {
    "placeholders": [
      "Тип закупки: новое или refurbished оборудование"
    ],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "firstPassFindings": 42,
    "fixed": 42,
    "recheckFindings": 0,
    "status": "pass"
  },
  "concerns": [
    "Российские цены являются оценками до получения коммерческих предложений с точными P/N, наличием и гарантией",
    "D-tier и refurbished-конфигурации требуют official CTO evidence, Service Tags и supplier quotations"
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "status": "partial",
    "summary": "Отчёт покрывает 79/79 требований, но закупочные гарантии остаются условными до benchmark, restore/failover drill, exact QVL/CTO и коммерческих предложений.",
    "open": [
      "300–500 RPS и 10 000 соединений не подтверждены production-like benchmark",
      "99,9%, RPO 5 минут и RTO 1 час не подтверждены failover/restore drill",
      "Российские цены и точные P/N требуют коммерческих предложений",
      "Бюджетная N-1 производительность ограничена примерно 250–300 RPS"
    ]
  }
}
