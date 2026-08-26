window.STATE =
{
  "slug": "deploy-readiness-audit",
  "dir": "2026-08-25-deploy-readiness-audit",
  "title": "Ревью и подготовка платформы «Технозрелость» к деплою (B2G)",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-08-25-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-08-25T09:50:59+04:00",
  "updatedAt": "2026-08-25T18:20:00+04:00",
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
      "status": "done",
      "startedAt": "2026-08-25T10:27:41+04:00",
      "note": "7 из 7 тасков готовы",
      "finishedAt": "2026-08-25T17:48:12+04:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-08-25T17:48:12+04:00",
      "finishedAt": "2026-08-25T17:48:12+04:00",
      "note": "ревью всех тасков парой ревьюеров, ремонты 04/05/06/07 закрыты"
    },
    {
      "id": "final",
      "status": "active",
      "startedAt": "2026-08-25T17:48:12+04:00",
      "note": "слепая приёмка пройдена, триаж закрыт, отчёт"
    }
  ],
  "requirements": {
    "total": 14,
    "done": 13,
    "inTicket": 0,
    "inSpec": 1,
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
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-08-25T15:20:08+04:00",
      "tests": {
        "passed": 23,
        "failed": 0
      },
      "commit": "b219fbd",
      "concerns": [
        "F03-02: санитизация новостей — передана таску 04 (закрыта ремонтом)",
        "CI: портировать repo-hygiene.yml при merge — решение владельца"
      ]
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
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-08-25T15:20:08+04:00",
      "tests": {
        "passed": 213,
        "failed": 0
      },
      "commit": "7b1e3cf",
      "concerns": [
        "Лимитеры in-memory — при кластере нужен Redis (F04-09)",
        "/docs открыт в проде (F04-08)",
        "F04-12: /api/v1/news отсутствует в platform-бэкенде → D02"
      ]
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
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-08-25T15:20:08+04:00",
      "tests": {
        "passed": 213,
        "failed": 0
      },
      "commit": "9d0e609",
      "concerns": [
        "clamav unhealthy: CDN-блок баз сигнатур до 26.08 — перепроверить на сервере",
        "Docker Desktop VM поднят до 6 ГБ RAM / 16 ГБ диск",
        "Чтение реестра без фолбэка при падении реплики (F05-09)"
      ]
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
        "05",
        "07"
      ],
      "wave": 4,
      "zone": [
        "technozrelost-backend/app (запросы)",
        "alembic",
        "technozrelost-frontend/src"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-08-25T17:48:12+04:00",
      "tests": {
        "passed": 268,
        "failed": 0
      },
      "commit": "0bf67bf",
      "concerns": [
        "Плато ~60 rps: 1 uvicorn-воркер на 2 vCPU; наивный --workers дублирует news-scheduler (F06-05)",
        "Диск Docker VM на 79% после инцидента с сидом НИОКТР",
        "Комментарии 0027 устарели после ремонта (неблок., косметика)"
      ]
    },
    {
      "id": "07",
      "title": "Перенос новостей и достижений на платформенный бэкенд",
      "requirements": [
        "G01",
        "D02",
        "R01",
        "R04"
      ],
      "blockedBy": [],
      "wave": 3,
      "zone": [
        "technozrelost-backend/app",
        "technozrelost-backend/tests",
        "technozrelost-backend/alembic"
      ],
      "status": "done",
      "startedAt": "2026-08-25T15:29:29+04:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-08-25T16:05:15+04:00",
      "tests": {
        "passed": 257,
        "failed": 0
      },
      "commit": "a4f5945",
      "concerns": [
        "Дубликат каталога медалей seed+SQL может разъезжаться",
        "422-vs-413 oversize между news.py и files.py",
        "Награды опоздавшим участникам при повторном событии",
        "Rate-limit на публичных чтениях новостей отсутствует"
      ]
    },
    {
      "id": "08",
      "title": "Полировка приёмки: ключи TLS вне git, легаси, 413, гард каталога",
      "requirements": [
        "R09",
        "R01"
      ],
      "blockedBy": [],
      "wave": 4,
      "zone": [
        "technozrelost-backend"
      ],
      "status": "done",
      "startedAt": "2026-08-25T18:20:00+04:00",
      "finishedAt": "2026-08-25T18:20:00+04:00",
      "tests": {
        "passed": 271,
        "failed": 0
      },
      "commit": "acbc080",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "concerns": [
        "deploy.sh: гард сертификата смотрит только fullchain.pem — half-state молча сломает nginx",
        "опечатка в докстринге теста каталога"
      ]
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 268,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": [
      "POSTGRES_PASSWORD",
      "REPL_PASSWORD",
      "MINIO_SECRET_KEY",
      "GRAFANA_ADMIN_PASSWORD",
      "NEXTAUTH_URL",
      "CORS_ORIGINS",
      "LLM_API_KEY"
    ]
  },
  "additions": [],
  "coverage": {
    "g2": "0 пропусков, 0 наполовину; 15 пунктов спеки сверх брифа — все R#.n-углубления и крафт, приняты"
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": "ses_fc791e81fffex6wg7jSX9F5HfD",
    "craft": "ses_fc791bb36ffeP1AYG5wbrLuRIt"
  },
  "blind": {
    "checked": 17,
    "matched": 14,
    "mismatches": [
      "Цель p95<500 мс достигается до ~60 одновременных пользователей; дефолтный профиль 200 упирается в CPU одного воркера (F06-05) — размер сервера решает",
      "ClamAV unhealthy на этой машине (CDN-блок баз сигнатур) — проверить при первом деплое на сервере",
      "Троттлинг логина in-memory: с двумя репликами backend лимит фактически удваивается — строгий лимит требует Redis (F04-09)"
    ]
  }
}
