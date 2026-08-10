# 03 — Append-only audit и наблюдаемость

**What to build:** Журнал чувствительных операций, структурированные redacted logs, метрики и alerts с отдельными kill switches.

**Blocked by:** 01 — SECURITY.md и THREAT_MODEL.md.

**Status:** ready-for-agent

- [ ] Auth, roles, verification, project access, invites, files, decisions, RAG и AI abuse журналируются без секретов/контента документов.
- [ ] Приложение не редактирует audit; полный просмотр требует отдельного permission.
- [ ] Alerts покрывают auth anomalies, 403 spikes, malware, mass downloads, health и resource pressure.
- [ ] AI, registration, uploads и external access отключаются независимо по runbook.
