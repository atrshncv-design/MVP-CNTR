# 07 — AI/RAG registry и eval

**Требования:** R03, R12, R19–R22, R25, R26, R30, R31
**Blocked by:** 01, 02, 05
**Зона:** `docs/audit/2026-09-21-production/07-ai/`
**Волна:** 7
**Status:** ready

## Что должно заработать

Полный AI-реестр, static/security/RAG-оценка и безопасный live eval до 200 запросов только на ГОСТах/синтетике. Если safe authenticated entrypoint недоступен, live eval — `UNKNOWN`, а не обход auth.

## Критерии приёмки

- [ ] `ai-registry.json` валиден по точной spec-схеме.
- [ ] Весь AI checklist spec покрыт static/runtime evidence или `UNKNOWN`; HTTP 200 не считается достаточным.
- [ ] Лимит ≤200 доказан; denylist и tenant boundaries проверены без ПДн/проектных секретов.
- [ ] Оценены grounding/citations/retrieval/fallback/timeouts/cost controls/observability/provider outage.
