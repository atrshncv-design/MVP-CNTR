# 03 — LLM rerank matching с fallback

**Требования:** R03
**Blocked by:** —
**Зона:** `src/features/matching/`
**Волна:** 1
**Status:** ready

## Что должно заработать
При `LLM_API_KEY` есть — rerank через LLM_API_BASE contour tuno с объяснением, иначе script fallback с бейджем. При ошибке — «LLM недоступен — script результат — Повторить».

## Из брифа
> «LLM + fallback»

## Разделы спецификации
Истории 3,4, Шов 2

## Критерии приёмки
- [ ] `rerankWithLlm` шлёт только чистые поля без ПДн, при успехе показывает `llm` бейдж + причины LLM, при 401/5xx → fallback script + бейдж fallback + Retry
- [ ] `LLM_API_BASE` берёт из env, без ключа — сразу script, без запроса
- [ ] Тест llm rerank mock
