# 04 — Блокирующий security CI

**What to build:** Автоматический pipeline secret/SAST/SCA/package/image/SBOM/RBAC/IDOR/migration/DAST/config проверок с policy исключений.

**Blocked by:** 01 — SECURITY.md и THREAT_MODEL.md; repo-hygiene/04 — Проверка чистого клона.

**Status:** ready-for-agent

- [ ] Lockfiles обязательны; новые package names/versions проверяются в официальных registry.
- [ ] Critical/high findings блокируют merge и release.
- [ ] Исключение содержит причину, владельца, срок и compensating control.
- [ ] Codex Security является дополнительным review, а не заменой инструментов.
