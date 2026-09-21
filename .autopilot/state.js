window.STATE =
{
  "slug": "production-technical-audit",
  "dir": "2026-09-21-production-technical-audit--wip",
  "title": "Полный технический аудит production MVP",
  "mode": "interview",
  "depth": "normal",
  "polish": null,
  "tier": "T3",
  "briefFile": "2026-09-21-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-09-21T16:44:28+04:00",
  "updatedAt": "2026-09-21T17:18:35+04:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-09-21T16:44:28+04:00", "finishedAt": "2026-09-21T16:51:50+04:00" },
    { "id": "manifest", "status": "done", "startedAt": "2026-09-21T16:51:50+04:00", "finishedAt": "2026-09-21T16:51:50+04:00", "note": "37 атомарных требований" },
    { "id": "briefing", "status": "done", "startedAt": "2026-09-21T16:51:50+04:00", "finishedAt": "2026-09-21T16:52:32+04:00", "note": "Интервью завершено: доступ, безопасность, AI, роли, реестры, UX, production-границы" },
    { "id": "spec", "status": "done", "startedAt": "2026-09-21T16:52:32+04:00", "finishedAt": "2026-09-21T17:12:47+04:00", "note": "G2 PASS после двух раундов дополнений" },
    { "id": "plan", "status": "done", "startedAt": "2026-09-21T17:12:47+04:00", "finishedAt": "2026-09-21T17:18:35+04:00", "note": "9 тасков, ярус T3, 9 последовательных волн" },
    { "id": "build", "status": "active", "startedAt": "2026-09-21T17:18:35+04:00", "note": "0 из 9 тасков готовы" },
    { "id": "review", "status": "pending" },
    { "id": "final", "status": "pending" }
  ],
  "requirements": { "total": 37, "done": 0, "inTicket": 34, "inSpec": 0, "placeholder": 0, "deferred": 3, "dropped": 0 },
  "tickets": [
    { "id": "01", "title": "Baseline: local, Git, server, production", "requirements": ["R01","R02","R03","R04","R05","R06","R23","R24","R30","R31","R37"], "blockedBy": [], "wave": 1, "zone": ["docs/audit/2026-09-21-production/00-evidence/","docs/audit/2026-09-21-production/01-environments.md"], "status": "done", "startedAt": "2026-09-21T17:25:02+04:00", "finishedAt": "2026-09-21T20:56:29+04:00", "retries": 0, "repairs": 1, "handoffs": 0 },
    { "id": "02", "title": "Функциональная карта и перенос", "requirements": ["R02","R03","R07","R08","R10","R25","R30","R31","R32"], "blockedBy": ["01"], "wave": 2, "zone": ["docs/audit/2026-09-21-production/02-features/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "03", "title": "Качество кода и архитектура", "requirements": ["R03","R09","R10","R25","R26","R30","R31","R35"], "blockedBy": ["02"], "wave": 3, "zone": ["docs/audit/2026-09-21-production/03-code/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "04", "title": "БД и защита данных", "requirements": ["R03","R11","R12","R14","R26","R30","R31"], "blockedBy": ["01"], "wave": 4, "zone": ["docs/audit/2026-09-21-production/04-database/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "05", "title": "Application security и RBAC", "requirements": ["R03","R12","R13","R14","R15","R25","R26","R30","R31"], "blockedBy": ["02","04"], "wave": 5, "zone": ["docs/audit/2026-09-21-production/05-security/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "06", "title": "UX/UI production", "requirements": ["R03","R16","R17","R18","R25","R26","R30","R31"], "blockedBy": ["02"], "wave": 6, "zone": ["docs/audit/2026-09-21-production/06-ux/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "07", "title": "AI/RAG registry и eval", "requirements": ["R03","R12","R19","R20","R21","R22","R25","R26","R30","R31"], "blockedBy": ["01","02","05"], "wave": 7, "zone": ["docs/audit/2026-09-21-production/07-ai/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "08", "title": "Эксплуатация и производительность", "requirements": ["R03","R06","R23","R24","R25","R26","R30","R31"], "blockedBy": ["01","04"], "wave": 8, "zone": ["docs/audit/2026-09-21-production/08-operations/"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 },
    { "id": "09", "title": "Синтез, backlog и gate-решение", "requirements": ["R01","R02","R03","R04","R05","R08","R26","R27","R28","R30","R31","R32","R34"], "blockedBy": ["02","03","04","05","06","07","08"], "wave": 9, "zone": ["docs/audit/2026-09-21-production/09-final/","docs/audit/2026-09-21-production/README.md"], "status": "pending", "retries": 0, "repairs": 0, "handoffs": 0 }
  ],
  "singlePass": null,
  "tests": { "ticket01": "evidence 19/19 + secret scan green; Ruff green; pytest blocked by absent 127.0.0.1:5432 (31 passed/720 setup errors); mypy blocked by Python 3.14/numpy stub mismatch; frontend dependencies absent (171 passed/38 fail, next build unavailable)" },
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": { "firstPassFindings": 7, "secondPassFindings": 3, "fixed": 10, "status": "pass", "note": "Добавлены чек-листы, MVP/инфра-границы, 16 артефактов, коммуникация, doctor и три явные схемы" },
  "concerns": [
    { "ticket": "01", "area": "test-environment", "note": "Full regression suite cannot be green in this checkout: test PostgreSQL and installed frontend dependencies are absent; mypy runtime/stub mismatch is pre-existing. No product code changed." },
    { "ticket": "01", "area": "deployment-evidence", "note": "deploy.log trails running image: last logged 8651cced865c, running f06b15c." }
  ],
  "reviewers": { "manifestSpec": null, "craft": null },
  "blind": null
}
