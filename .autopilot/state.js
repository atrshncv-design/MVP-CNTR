window.STATE =
{
  "slug": "mvp-deploy-scope",
  "dir": "2026-09-15-mvp-deploy-scope",
  "title": "MVP деплой: минимум мощностей и скоуп функций",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": "2026-09-15-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-09-15T08:34:37+04:00",
  "updatedAt": "2026-09-15T08:44:18+04:00",
  "finishedAt": "2026-09-15T08:44:18+04:00",
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-09-15T08:34:37+04:00", "finishedAt": "2026-09-15T08:34:59+04:00" },
    { "id": "manifest", "status": "done", "startedAt": "2026-09-15T08:34:59+04:00", "finishedAt": "2026-09-15T08:35:48+04:00", "note": "4 требования" },
    { "id": "briefing", "status": "done", "startedAt": "2026-09-15T08:35:48+04:00", "finishedAt": "2026-09-15T08:39:12+04:00", "note": "пилот/облако РФ/без Replica" },
    { "id": "spec", "status": "done", "startedAt": "2026-09-15T08:39:12+04:00", "finishedAt": "2026-09-15T08:40:35+04:00", "note": "G2 pass" },
    { "id": "plan", "status": "skipped", "startedAt": "2026-09-15T08:40:35+04:00", "finishedAt": "2026-09-15T08:41:01+04:00", "note": "ярус T0 — без разбивки на таски" },
    { "id": "build", "status": "done", "startedAt": "2026-09-15T08:41:01+04:00", "finishedAt": "2026-09-15T08:42:55+04:00", "note": "отчёт готов, 27e747a" },
    { "id": "review", "status": "done", "startedAt": "2026-09-15T08:42:55+04:00", "finishedAt": "2026-09-15T08:42:55+04:00", "note": "self-review T0: чисто" },
    { "id": "final", "status": "done", "startedAt": "2026-09-15T08:42:55+04:00", "finishedAt": "2026-09-15T08:44:18+04:00", "note": "приёмка pass, отчёт сдан" }
  ],
  "requirements": {
    "total": 4, "done": 4, "inTicket": 0, "inSpec": 0,
    "placeholder": 0, "deferred": 0, "dropped": 0
  },
  "tickets": [],
  "singlePass": { "files": ["work/report.md"], "tests": "docs-only, код не тронут; state.js parses OK, secret-scan чист", "commit": "27e747a", "startedAt": "2026-09-15T08:41:01+04:00", "finishedAt": "2026-09-15T08:42:55+04:00" },
  "tests": null,
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": {
    "firstPassFindings": 0,
    "fixed": 0,
    "recheckFindings": 0,
    "status": "pass",
    "extra": 16,
    "extraNote": "G2 independent: missing 0, half-covered 0; in-spec-not-in-brief 16 — всё природителено к R01-R04i и брифингу Q1-Q4 (пилот/облако/без Replica), вырезать нечего"
  },
  "concerns": [],
  "reviewers": { "manifestSpec": null, "craft": null },
  "blind": {
    "status": "pass",
    "summary": "4/4 реализовано: минимум, Day-1, backlog, привязка к репо; секретов-значений нет",
    "open": []
  }
}
