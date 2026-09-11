# 08 — Производительность и масштабирование

**Требования:** R03-R10, R26, R27, R33
**Blocked by:** —
**Зона:** `evidence/08-performance-resilience.md`
**Волна:** 1
**Status:** ready

## Что должно заработать

Построена доказательная capacity/failure модель для 100–10000 concurrent: БД, pools,
Redis, workers, очереди, файлы, AI, CPU/RAM, timeouts и graceful degradation.

## Критерии приёмки

- [ ] Расчётные оценки отделены от измеренных результатов
- [ ] Найдены unbounded/N+1/retry/queue/connection bottlenecks с точными call-sites
- [ ] Проверены multi-replica coordination, graceful shutdown и memory-risk paths
- [ ] Для каждого масштаба указаны первые ожидаемые пределы и необходимые замеры
- [ ] Evidence написан без разрушительного load test
