# 11 — CODE-02: атомарные AI-счётчики

**Требование:** R23. **После:** T10 green-checkpoint; общий regression после T12. **Зона:** `technozrelost-backend/app/services/ai_metrics.py`, прямые изменения AI-счётчиков в `ai_assistant.py` и `api/v1/chat.py`, тесты AI wiring.

## Изменение

- Инкапсулировать обновление AI counters за потокобезопасными функциями в `ai_metrics.py`; `snapshot()` должен возвращать согласованную копию под той же блокировкой.
- Заменить каждый прямой `METRICS[...] += ...` в приложении на API; после изменения прямых записей в глобальный dict не должно остаться.
- Использовать существующие in-memory semantics, ключи и типы метрик. Не менять rate-limit policy, semaphore, HTTP/API contracts, provider calls, DB или dependencies.
- Добавить конкурентный test: много потоков инкрементируют один counter, итоговый snapshot равен точному числу событий; existing AI metric behavior tests остаются зелёными.

## Приёмка

- Все writes counters атомарны; snapshot не читает частично обновлённое состояние.
- Конкурентный regression стабилен; поиск по `app/` не находит прямых `METRICS[...]` mutations.
- Ruff, Python 3.11 mypy и related AI tests зелёные; полный backend regression запускает оркестратор после T12.
- Никаких изменений production, БД/миграций, конфигурации, внешних API или AI ключей. Исполнитель не коммитит/пушит.
