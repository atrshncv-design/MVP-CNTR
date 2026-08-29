# Тикет 01 — LLM-гейтвей (N-05)

**Требования:** R03 (N-05)
**Зависит от:** —
**Зона:** `technozrelost-backend/app/services/ai_assistant.py`, `app/core/config.py`, `app/services/rag.py`

## Задача
Закрыть `N-05` `BACKLOG.md:50`: `project.name` и доки уходят в `ask_llm` без маскировки. Сделать `LLM_GATEWAY_ENABLED=false` по умолчанию, allowlist полей `title+annotation/sector/ugt/region/competencies` `25-`, `contour` `tuno/kaba` `13-`, `nh3` на оба входа.

## Приёмка
- [ ] `Settings.llm_gateway_enabled` `config.py:57` `false`, `ask_llm` `ai_assistant.py:31` `None` без флага
- [ ] Тест `название с ФИО не покидает контур` зелёный `Plan.md:G2`
- [ ] `pytest -q` `ruff` `mypy` зелёные

## Связи
`N-05` `spec История 1` `R22` `contour`
