# 05 — AI, RAG и файлы

**Требования:** R03-R10, R24, R25, R28-R30, R34, R35
**Blocked by:** —
**Зона:** `evidence/05-ai-files-security.md`
**Волна:** 1
**Status:** ready

## Что должно заработать

Прослежены LLM/RAG/file flows, PII/gateway, injection, timeout/queue/fallback, parsing,
hallucinations, reproducibility, embeddings/rerank, OCR/PDF/table и document generation.

## Критерии приёмки

- [ ] Проверен unavailable upstream и класс `AI_APICallError`
- [ ] Проверены prompt injection, confidential egress, logs/storage, cost/token limits
- [ ] Проверены MIME/size/path/AV и lifecycle файлов
- [ ] Заявленные AI/document возможности сопоставлены с реальным кодом и тестами
- [ ] Evidence написан, внешней LLM секреты/данные не отправлены
