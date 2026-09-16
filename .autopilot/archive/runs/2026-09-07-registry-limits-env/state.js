window.STATE =
{
  "slug": "registry-limits-env",
  "dir": "2026-09-07-registry-limits-env",
  "title": "Лимиты реестра в env (второй проход по конфигам)",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": "2026-09-07-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-09-07T10:15:39+04:00",
  "updatedAt": "2026-09-07T10:35:09+04:00",
  "finishedAt": "2026-09-07T10:35:09+04:00",
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-09-07T10:15:39+04:00", "finishedAt": "2026-09-07T10:16:00+04:00" },
    { "id": "manifest",  "status": "done", "startedAt": "2026-09-07T10:16:00+04:00", "finishedAt": "2026-09-07T10:17:00+04:00", "note": "3 требования" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-09-07T10:17:00+04:00", "finishedAt": "2026-09-07T10:18:00+04:00", "note": "вопросов не потребовалось" },
    { "id": "spec",      "status": "done", "startedAt": "2026-09-07T10:18:00+04:00", "finishedAt": "2026-09-07T10:20:00+04:00", "note": "G2 pass" },
    { "id": "plan",      "status": "skipped", "startedAt": "2026-09-07T10:20:00+04:00", "finishedAt": "2026-09-07T10:20:00+04:00", "note": "ярус T0 — без разбивки на таски" },
    { "id": "build",     "status": "done", "startedAt": "2026-09-07T10:20:00+04:00", "finishedAt": "2026-09-07T10:32:00+04:00", "note": "ярус T0 — один проход" },
    { "id": "review",    "status": "done", "startedAt": "2026-09-07T10:32:00+04:00", "finishedAt": "2026-09-07T10:32:00+04:00", "note": "проверено inline T0" },
    { "id": "final",     "status": "done", "startedAt": "2026-09-07T10:32:00+04:00", "finishedAt": "2026-09-07T10:35:00+04:00" }
  ],
  "requirements": {
    "total": 3, "done": 3, "inTicket": 0, "inSpec": 0,
    "placeholder": 0, "deferred": 0, "dropped": 0
  },
  "singlePass": {
    "startedAt": "2026-09-07T10:20:00+04:00",
    "finishedAt": "2026-09-07T10:32:00+04:00",
    "files": ["technozrelost-backend/app/core/config.py", "technozrelost-backend/app/api/v1/nioktr.py", "technozrelost-backend/.env.example", "technozrelost-backend/tests/test_api_error_locale.py"],
    "tests": { "passed": 405, "failed": 0 },
    "commit": "026b85b"
  },
  "tests": null,
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": {
    "firstPassFindings": 0,
    "fixed": 0,
    "recheckFindings": 0,
    "status": "pass",
    "extra": 8,
    "extraNote": "EXTRA — craft-решения (имена/типы/дефолты) + Вне рамок, свободных A нет"
  },
  "concerns": [],
  "reviewers": { "manifestSpec": null, "craft": null },
  "blind": {
    "status": "pass",
    "summary": "3/3 реализовано живьём: лимиты в env, дефолты те же, сюита зелёная",
    "open": []
  }
}
