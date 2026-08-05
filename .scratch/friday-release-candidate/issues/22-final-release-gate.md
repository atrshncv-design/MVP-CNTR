# 22 — Финальный black-box release gate

**What to build:** Принять release candidate одним внешним сценарием и подготовить точный handoff серверному AI-агенту.

**Blocked by:** 09–21 — все пользовательские и эксплуатационные возможности

**Status:** done

- [x] E2E проводит один проект последовательно УГТ 1→9
- [x] Проверены reject/fix/resubmit, роли, приватность, реестры и экспорт
- [x] Зелёные frontend lint/type/build/tests и backend ruff/pytest/migrations
- [x] Зелёные Docker smoke, backup/restore, security и theme/browser gates
- [x] Deploy runbook выполняется с чистой Linux-машины через env и одну команду
- [x] PROGRESS.md и Status.md совпадают с фактическим состоянием


## Реализация (05.08.2026)
- Black-box release gate: все гейты зелёные (190 pytest, frontend lint/tsc/test/build, compose, backup, security); фиксы B1 (публичные реестры `35594a2`), resubmit отклонённых драфтов, backup.sh PGPASSWORD; отчёт: `release-gate-report.md`; тикеты 13–15 в трекерах приведены к факту.