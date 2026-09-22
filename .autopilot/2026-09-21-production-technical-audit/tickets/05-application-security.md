# 05 — Application security и RBAC

**Требования:** R03, R12–R15, R25, R26, R30, R31
**Blocked by:** 02, 04
**Зона:** `docs/audit/2026-09-21-production/05-security/`
**Волна:** 5
**Status:** ready

## Что должно заработать

Полный static/test/read-only security-аудит auth, session, RBAC, ownership+invite, OWASP, uploads, headers, secrets, supply chain и containers. Без test accounts авторизованный runtime остаётся `UNKNOWN`.

## Критерии приёмки

- [ ] Весь application-security checklist spec покрыт или честно `UNKNOWN`.
- [ ] UI и backend authorization сверены; роль+владение+приглашение и ручные гейты УГТ/верификации проверены.
- [ ] Никакого fuzzing, destructive payload, credential read или production mutation.
- [ ] Findings не завышают severity и разделяют confirmed/risk/debt/recommendation.
