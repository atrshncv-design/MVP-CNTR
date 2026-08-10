# 08 — Kali staging-пентест и финальный release gate

**What to build:** Авторизованный внешний тест staging с synthetic data, отчётом, retest и сводным release decision по двенадцати сценариям.

**Blocked by:** 02 — Карантин файлов; 03 — Audit/observability; 04 — Security CI; 06 — Backup/restore; 07 — Capacity report; все feature-пакеты.

**Status:** ready-for-agent

- [ ] Scope, targets, window, rate limit, запреты, stop switch и тестовые роли письменно зафиксированы.
- [ ] Проверены auth, IDOR, uploads, headers, rate limits, AI abuse и data exposure без destructive DoS.
- [ ] Critical/high исправлены и повторно проверены; остаточный риск задокументирован.
- [ ] Release report содержит functional, legal, infrastructure и security blockers отдельно.
