# Тикет 06 — RAG контур + мэтчинг + админка + доки (R22,R23,R24)

**Требования:** R22,R23,R24
**Зависит от:** 04 (индексы), 01 (LLM gateway allowlist)
**Зона:** `app/db/models.py:rag_documents`, `app/services/rag.py:26`, `app/api/v1/rag.py`, `app/api/v1/chat.py`, `technozrelost-frontend/src/app/dashboard/cntr_admin/page.tsx`, `technozrelost-frontend/src/app/dashboard/cntr_manager/page.tsx:72`, `docs/`, `app/core/config.py`

## Задача
`0028` `contour CHECK(tuno,kaba)` два `ivfflat WHERE`, `POST /chat/tuno|kaba` `rag.py:26`, `POST /match` 5 полей `title+annotation/sector/ugt/region/competencies` `25-` топ-5 через центр `14- V2` `queue llm-eval`, админка max `19-` `KPI 12` `manager` урезан `cntr_manager:72`, доки мгновенные `22-` `docs/adr` + `SOPS` `23-`.

## Приёмка
- [ ] `alembic 0028` `contour`, `POST /match` `200` топ-5 с `почему`
- [ ] `cntr_admin` видит `KPI`, `cntr_manager` без `Бюджет`

## Связи
`spec Истории 20-23` `13-` `14-` `19-` `25-`
