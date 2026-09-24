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
  "updatedAt": "2026-09-24T07:49:35+04:00",
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
      "startedAt": "2026-09-23T12:04:44+04:00"
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
    "total": 41,
    "done": 2,
    "inTicket": 3,
    "inSpec": 34,
    "placeholder": 0,
    "deferred": 2,
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
      "status": "in-progress",
      "startedAt": "2026-09-23T12:04:44+04:00",
      "lastAttemptStartedAt": "2026-09-24T07:49:35+04:00",
      "retries": 1,
      "repairs": 0,
      "handoffs": 0
    }
  ],
  "singlePass": null,
  "executionPolicy": {
    "executor": "opencode-go/muse-spark-1.3-contributor",
    "ticket": "T02",
    "mode": "fresh-session; no commit; no run-file edits"
  },
  "tests": {
    "ticket01": "evidence 19/19 + secret scan green; Ruff green; pytest blocked by absent 127.0.0.1:5432 (31 passed/720 setup errors); mypy blocked by Python 3.14/numpy stub mismatch; frontend dependencies absent (171 passed/38 fail, next build unavailable)",
    "ticket02": "CSV schema/status/evidence validation green: 33 rows, fixed 12-column schema, closed statuses, no empty evidence IDs; table count independently verified as 36; focused secret scan green",
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
      "ticket": "01",
      "area": "test-environment",
      "note": "Full regression suite cannot be green in this checkout: test PostgreSQL and installed frontend dependencies are absent; mypy runtime/stub mismatch is pre-existing. No product code changed."
    },
    {
      "ticket": "01",
      "area": "deployment-evidence",
      "note": "deploy.log trails running image: last logged 8651cced865c, running f06b15c."
    },
    {
      "ticket": "03",
      "area": "craft",
      "file": "docs/audit/2026-09-21-production/03-code/findings.json",
      "note": "CODE-01 groups several fallback contours without a complete suppression inventory."
    },
    {
      "ticket": "04",
      "area": "data-protection",
      "file": "docs/audit/2026-09-21-production/04-database/README.md",
      "note": "Masking/log controls remain UNKNOWN; token hashing and seed behavior are separate controls and do not prove log masking."
    },
    {
      "ticket": "04",
      "area": "migrations",
      "file": "docs/audit/2026-09-21-production/04-database/db-model.md",
      "note": "Only migration 0036 downgrade was inspected; chain-wide downgrade/transaction/rollback coverage remains partial."
    },
    {
      "ticket": "05",
      "area": "evidence-scope",
      "file": "docs/audit/2026-09-21-production/05-security/findings.json",
      "note": "Some static/local observations list production in affected_environments although deployed behavior is UNKNOWN because server HEAD differs; final synthesis must not present those as confirmed production findings."
    },
    {
      "ticket": "06",
      "area": "screenshot-safety",
      "file": "docs/audit/2026-09-21-production/06-ux/check_ux.py",
      "note": "The artifact gate scans screenshot filenames, not rendered text inside PNGs; screenshots are public unauthenticated pages, but content-level sensitive-data absence is not machine-proven."
    },
    {
      "ticket": "07",
      "area": "artifact-gate",
      "file": "docs/audit/2026-09-21-production/07-ai/check_ai.py",
      "note": "The AI gate checks non-empty arrays and token presence but does not enforce the reported 6/5 cardinalities or item-level semantic coverage; final synthesis must treat it as a structural gate, not a semantic oracle."
    },
    {
      "ticket": "08",
      "area": "artifact-gate",
      "file": "docs/audit/2026-09-21-production/08-operations/check_ops.py",
      "note": "The operations gate uses substring coverage and does not prove item-level evidence or UNKNOWN status; final synthesis must retain the report's explicit evidence boundaries."
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
