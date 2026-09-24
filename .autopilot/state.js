window.STATE =
{
  "slug": "production-stabilization",
  "dir": "2026-09-23-production-stabilization--wip",
  "title": "Стабилизация production по итогам аудита 2026-09-21",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T3",
  "briefFile": "2026-09-23-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.config/opencode/skills/autopilot",
  "startedAt": "2026-09-23T11:36:02+04:00",
  "updatedAt": "2026-09-24T08:41:27+04:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-23T11:36:02+04:00",
      "finishedAt": "2026-09-23T11:37:00+04:00",
      "estimated": true
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-23T11:37:00+04:00",
      "finishedAt": "2026-09-23T11:52:00+04:00",
      "note": "32 R + 9 G; исходная задача verbatim зафиксирована",
      "estimated": true
    },
    {
      "id": "briefing",
      "status": "skipped",
      "startedAt": "2026-09-23T11:37:00+04:00",
      "finishedAt": "2026-09-23T11:52:00+04:00",
      "note": "решения пользователя записаны в Дополнения; вопросов не осталось",
      "estimated": true
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-23T11:52:00+04:00",
      "finishedAt": "2026-09-23T12:04:00+04:00",
      "note": "G2 independent pass completed; findings recorded and fixed",
      "estimated": true
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-23T12:04:00+04:00",
      "finishedAt": "2026-09-23T12:04:44+04:00",
      "note": "T02 cut; atomized order captured in spec",
      "estimated": true
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-09-23T12:04:44+04:00",
      "note": "T02/T22 backend test baseline green; T03/T04 pending"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-24T08:14:03+04:00",
      "finishedAt": "2026-09-24T08:15:58+04:00",
      "finishedAtObservedAt": "2026-09-24T08:15:58+04:00",
      "note": "Independent diff/scope review: no executor changes; red regression blocks commit"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 45,
    "done": 4,
    "inTicket": 4,
    "inSpec": 34,
    "placeholder": 0,
    "deferred": 3,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "База, worktree, baseline (R04/G01)",
      "requirements": [
        "R04",
        "G01"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        ".autopilot/2026-09-23-production-stabilization--wip/"
      ],
      "status": "done",
      "startedAt": "2026-09-23T11:38:24+04:00",
      "finishedAt": "2026-09-23T12:10:00+04:00",
      "estimated": true,
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "commit": "08555e4",
      "tests": {
        "passed": 1,
        "failed": 0
      },
      "concerns": []
    },
    {
      "id": "02",
      "title": "Воспроизводимый backend test environment (CODE-03)",
      "requirements": [
        "R05",
        "R20",
        "R21"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "technozrelost-backend/"
      ],
      "status": "done",
      "startedAt": "2026-09-23T12:04:44+04:00",
      "lastAttemptStartedAt": "2026-09-24T07:52:38+04:00",
      "retries": 1,
      "repairs": 0,
      "handoffs": 0,
      "executorModel": "openai/gpt-6-luna",
      "finishedAtObservedAt": "2026-09-24T08:15:58+04:00",
      "finishedAt": "2026-09-24T08:41:27+04:00",
      "tests": {
        "sync": "exit 0; resolved 79, checked 76",
        "ruff": "exit 0",
        "mypy": "exit 2; numpy stub syntax error under Python 3.14",
        "pytest": "after T22 exit 0; 720 passed, 1 warning; 560.65s"
      },
      "blocker": "mypy remains blocked by Python 3.14/numpy stub syntax; T04 owns toolchain repair. Historical 15 pytest failures fixed by T22.",
      "review": "No executor diff; no code to commit; lock files unchanged; no blocking diff finding.",
      "evidence": ".autopilot/2026-09-23-production-stabilization--wip/evidence/T02-verification.md"
    },
    {
      "id": "22",
      "title": "Восстановить контракт mocks оценки стадий (D01)",
      "requirements": ["D01"],
      "blockedBy": ["01"],
      "wave": 2,
      "zone": ["technozrelost-backend/tests/"],
      "status": "done",
      "startedAt": "2026-09-24T08:23:23+04:00",
      "executorModel": "gpt-6-luna",
      "reasoningEffort": "high",
      "finishedAt": "2026-09-24T08:41:27+04:00",
      "commit": "14eca1d",
      "tests": {"focused": "28 passed", "full": "720 passed, 1 warning", "ruff": "exit 0"},
      "evidence": ".autopilot/2026-09-23-production-stabilization--wip/evidence/T22-verification.md",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "23",
      "title": "Ассистент по документам (kaba)",
      "requirements": ["R33"],
      "blockedBy": ["03", "04", "08", "14"],
      "status": "pending",
      "zone": ["technozrelost-backend/app/services/", "technozrelost-frontend/src/features/docs/"]
    },
    {
      "id": "24",
      "title": "Ассистент по реестрам (tuno)",
      "requirements": ["R33"],
      "blockedBy": ["03", "04", "08", "14"],
      "status": "pending",
      "zone": ["technozrelost-backend/app/api/v1/chat.py", "technozrelost-frontend/src/app/dashboard/ai-assistant/"]
    }
  ],
  "singlePass": null,
  "executionPolicy": {
    "executor": "codex/gpt-6-luna:high",
    "currentAuthorization": "user explicitly switched implementation from OpenCode to Codex GPT-6 Luna high on 2026-09-24",
    "executorAuthorization": "user authorized on 2026-09-24 after opencode-go subscription launch error",
    "priorLaunch": "opencode-go/muse-spark-1.3-contributor failed before work: active subscription required; no return contract; worktree clean",
    "pytestIndependent": "after T22 completed exit 0; 720 passed, 1 warning; 560.65s"
  },
  "tests": {
    "ticket01": "evidence 19/19 + secret scan green; Ruff green; pytest blocked by absent 127.0.0.1:5432 (31 passed/720 setup errors); mypy blocked by Python 3.14/numpy stub mismatch; frontend dependencies absent (171 passed/38 fail, next build unavailable)",
    "ticket02": "Independent: uv sync exit 0 (79 resolved/76 checked); Ruff exit 0; mypy exit 2 (Python 3.14/numpy stub syntax, T04); pytest after T22 exit 0 (720 passed, 1 warning, 560.65s). Local test DB technozrelost_test confirmed; see evidence/T02-verification.md.",
    "ticket03": "findings JSON valid (6 records); Ruff green; reproducible Python and JS/TS inventories; coupling command exit 0 with 5 lines/4 cross-import facts; remaining product suites retain exact environment blockers",
    "ticket04": "findings JSON schema valid (6 records); production catalog SELECTs succeeded without credential values/business rows; targeted migration test BLOCKED by absent local test DB (1 setup error); focused secret scan green",
    "ticket05": "findings JSON valid (5 records with effort/risk); independent non-DB security suite 32 passed; Ruff green by executor; DB-backed suite remains environment BLOCKED without local test DB",
    "ticket06": "check_ux.py green: 2 findings, 41 screenshots, viewports 1920/768/375; three JSON artifacts valid; frontend npm baseline remains 171 pass/38 fail because next-intl is absent",
    "ticket07": "check_ai.py green: 6 registry entries, 5 findings, 32 checklist tokens, 0/200 live calls; three JSON artifacts valid; independent non-DB pytest repeat 32 passed",
    "ticket08": "check_ops.py green: 6 findings, 27 checklist tokens, no load; findings JSON valid with 21 keys per record; two scoped re-reviews clean",
    "ticket09": "check_final.py green: 30 unique findings, 16/16 artifacts mapped, root README and gate included; UX/AI/operations sibling gates green",
    "finalRegression": "Ruff green; backend pytest 720 setup errors due absent PostgreSQL; mypy blocked by numpy stub/Python 3.14; frontend 171 passed/38 missing next-intl; build blocked because next is absent; focused non-DB set previously 32 passed"
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "firstPassFindings": 31,
    "fixed": 31,
    "recheckFindings": 0,
    "status": "pass",
    "extra": 4,
    "extraNote": "Independent G2 against verbatim brief and spec; 12 missing, 15 half-covered, 4 extra identified and addressed."
  },
  "concerns": [
    {
      "ticket": "02",
      "finding": "STAB-TEST-01",
      "note": "15 existing tests fail because _fake_ok_llm mocks in four test files reject session_id passed by stages.py; repair is outside T02 scope."
    },
    {
      "ticket": "02",
      "finding": "TOOLCHAIN-01",
      "note": "mypy cannot analyze app under Python 3.14 because installed numpy stub syntax requires Python 3.12+."
    }
  ],
  "reviewers": {
    "manifestSpec": "/root/economy_manifest_spec",
    "craft": "/root/economy_craft"
  },
  "concernTriage": {
    "fixNow": 0,
    "report": 9,
    "drop": 0,
    "note": "All deferred concerns are evidence-boundary or environment limitations already carried into the final report; none warrants changing product code in this audit-only run."
  },
  "blind": {
    "status": "pass-with-conditions",
    "verdict": "GO WITH CONDITIONS",
    "drift": [],
    "implemented": [
      "environment evidence",
      "feature matrix",
      "architecture map",
      "unified findings",
      "UX public pass",
      "risk matrix",
      "quick wins",
      "30/60/90",
      "backlog",
      "UNKNOWN register",
      "gate decision"
    ],
    "partial": [
      "server/runtime evidence",
      "database/data protection",
      "authorized security runtime",
      "live AI",
      "operations/restore/performance"
    ],
    "unavailable": [
      "safe test accounts",
      "live AI production eval",
      "load/fuzz/restart/restore",
      "RPO/RTO proof",
      "offsite contents",
      "at-rest encryption",
      "full DB internals and logs"
    ],
    "commands": [
      "check_final.py: 30 findings, 16/16 artifacts",
      "check_ops.py: 6 findings",
      "check_ai.py: 6 entries, 0/200",
      "check_ux.py: 2 findings, 41 screenshots"
    ]
  },
  "baseSha": "83d3c9bf2c0dab8951bed262183483a486a58666",
  "branch": "autopilot/production-stabilization",
  "worktree": ".worktrees/production-stabilization",
  "timePolicy": "Original event timestamps retained; estimated:true marks recovered/approximate timestamps. Restart attempts use lastAttemptStartedAt; no backdating.",
  "runStartedAtEstimated": false
}
