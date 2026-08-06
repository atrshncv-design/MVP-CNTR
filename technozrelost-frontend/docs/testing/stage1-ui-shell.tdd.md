# Stage 1 UI shell — TDD evidence

## Source

Approved direction: Huashu B, «Процесс в центре». Product constraints are
defined in the recovery docs branch under `DESIGN.md` and
`design/phase-1/direction-approved.md`.

## User journeys

1. An unauthenticated user recognizes the platform, enters credentials, sees a
   loading state, and receives an accessible error if authentication fails.
2. An authenticated user receives one consistent global navigation shell.
3. A customer without API-backed projects sees an honest empty state and can
   start the first application; no fabricated KPI is displayed.

## RED

Command: `npm test`

Result before implementation: `0 passed, 3 failed`. The failures identified
the generic login, missing process-first navigation, and hard-coded customer
KPI values.

## GREEN

Command: `npm test`

Result after implementation: `3 passed, 0 failed`.

| Guarantee | Test | Type | Result |
| --- | --- | --- | --- |
| Login exposes product identity and explicit loading/error states | `tests/ui-shell.test.mjs` | contract | PASS |
| Dashboard shell exposes approved global navigation and skip link | `tests/ui-shell.test.mjs` | contract | PASS |
| Customer workspace removes fabricated KPI and provides an honest empty state | `tests/ui-shell.test.mjs` | contract | PASS |

## Verification

- `npm run lint` — PASS.
- `npm run build` — PASS, 22 routes generated.
- Agent Browser at 1440×900 — PASS: headings, required email/password fields,
  submit button, and registration link are present in the accessibility tree;
  no browser errors were reported.
- Graphify review-delta — auth/dashboard history is the principal blast radius;
  no additional application files are impacted.

## Known gaps

- The customer empty state cannot load real projects until the project-list API
  contract is implemented in the next stage-1 slice.
- `npm audit` could not reach the npm registry during this run. The installer
  reported three high-severity advisories; they remain an explicit security
  follow-up and were not auto-fixed with a potentially breaking `--force`.
- Browser verification of authenticated dashboard content requires a seeded
  test account and running backend; this slice verified the public login and
  compile-time server-component contracts.
