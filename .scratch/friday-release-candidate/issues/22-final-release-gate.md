# 22 — Финальный black-box release gate

**What to build:** Принять release candidate одним внешним сценарием и подготовить точный handoff серверному AI-агенту.

**Blocked by:** 09–21 — все пользовательские и эксплуатационные возможности

**Status:** ready-for-agent

- [ ] E2E проводит один проект последовательно УГТ 1→9
- [ ] Проверены reject/fix/resubmit, роли, приватность, реестры и экспорт
- [ ] Зелёные frontend lint/type/build/tests и backend ruff/pytest/migrations
- [ ] Зелёные Docker smoke, backup/restore, security и theme/browser gates
- [ ] Deploy runbook выполняется с чистой Linux-машины через env и одну команду
- [ ] PROGRESS.md и Status.md совпадают с фактическим состоянием
