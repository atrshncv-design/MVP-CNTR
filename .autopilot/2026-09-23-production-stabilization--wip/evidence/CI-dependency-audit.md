# CI dependency audit — newly exposed gate

Дата: 2026-09-24. GitHub Actions run `35958291085` на `6799a9a` (branch `autopilot/production-stabilization`): Frontend job failure на шаге `Dependency audit`; lint/tests/build skipped. Backend job failure на mypy; Ruff и backend dependency audit прошли, pytest skipped. Run `35958363466` на `8ce3012` был in_progress при проверке.

Локальный read-only `npm audit --audit-level=high --json` (exit 1) подтвердил high/critical:

- D05/T28: `next` critical, vulnerable range 16.0.0–16.3.2, [Windows-hosted RCE](https://github.com/advisories/GHSA-p293-qw3h-jr36) и [AVIF image optimization RCE](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4); `fixAvailable=true`.
- D06/T29: `sharp` high, range <0.35.4, [libheif advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c); `fixAvailable=true`.
- D07/T30: `browserslist` high, range <=4.28.6, [OOM](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) и [prototype-write/crash](https://github.com/advisories/GHSA-73wf-gq98-2v4g); `fixAvailable=true`.

Неблокирующие для `--audit-level=high` moderate: `baseline-browser-mapping`, `exceljs`/`uuid`; их нельзя молча считать устранёнными. Версии/URL advisories сохранены в выводе `npm audit`, без секретов или пользовательских данных. В этом evidence ничего не исправлено и production не затрагивался.
