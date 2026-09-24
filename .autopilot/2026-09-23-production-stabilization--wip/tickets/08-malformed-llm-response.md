# 08 — AI-02: валидация 200-ответа LLM и malformed metric

**Требование:** R24 (часть AI-02), предпосылка T23/T24. **После:** T07 и regression-гейта. **Зона:** backend `app/services/ai_assistant.py`, `app/services/ai_metrics.py`, узкие AI-тесты.

## Контекст и RED

`docs/audit/2026-09-21-production/09-final/findings.json` → `AI-02`: `ask_llm` прямым индексированием читает `payload["choices"][0]["message"]["content"]` после HTTP 200. Неправильный JSON/структура попадает в общий `errors_total` и честный fallback, но неотличим от отказа провайдера. Сначала подтвердить путь в коде и добавить failing tests с синтетическим mock response: отсутствующие/пустые choices, неверный message/content, пустая строка и не-JSON 200. Не вызывать внешнюю модель, не передавать проекты/ПДн.

## Изменение

- Валидировать envelope ответа на узкой границе до возврата текста; только непустая строка content считается синтезом. Существующий честный fallback (`None`) и пользовательский контракт не менять.
- Добавить отдельный монотонный `malformed_total` в существующий AI metrics snapshot; для некорректного 200 увеличивать его (и сохранять `errors_total` как общий счётчик ошибок, если он уже используется как aggregate). HTTP non-200/timeout должны оставаться в своих прежних категориях, без ложного `malformed_total`.
- Логи только тип/краткая категория и модель, не raw payload, prompt, ключ, документ или текст пользователя. Не менять prompts, RAG, провайдера, конфиг и production.

## Приёмка

Focused RED→GREEN tests различают malformed 200, HTTP failure и timeout; метрики и fallback проверены. Ruff, mypy и затронутые AI-тесты проходят; полный backend suite — оркестратор на regression-гейте. Исполнитель сдаёт diff/evidence, не трогает `.autopilot/**`, не коммитит/push'ит. Live provider eval остаётся BLOCKED до нового ключа владельца.
