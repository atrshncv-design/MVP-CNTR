# EV-004 — публичные HTTP-пробы (низкая частота, read-only)

- Дата: UTC 2026-09-21T13:26Z
- Target: `https://technozrelost.atrshnjc.beget.tech/`
- Команды: `curl -m 15 <health|ready|/|metrics>` — по одному GET на endpoint,
  без auth, без создания данных
- Exit: 0; HTTP-статусы: все 200. Тела ответов сохранены только в виде
  санитизированных выдержек ниже (полные тела не коммитятся).

## Санитизированные результаты

- `GET /api/v1/health` → 200, 0.95с, 49B:
  `{"status":"ok","service":"technozrelost-backend"}`
- `GET /api/v1/ready` → 200, 0.69с, 116B:
  `{"status":"ready","databases":{"primary":"ok","replica":"not_configured"},"redis":"ok","storage":"ok","clamav":"ok"}`
  (replica отсутствует — факт single-node; оценка — operations-отчёт)
- `GET /` (landing) → 200, 1.22с, 261896B (только status/size/timing, тело не сохранялось)
- `GET /api/v1/metrics` → 200, 6583B; выдержка — только route-шаблоны
  (сырые path не собираются, кардинальность не раздувалась):
  `route="/api/v1/health"`, `route="/api/v1/metrics"`,
  `route="/api/v1/news"`, `route="/api/v1/news/categories"`,
  `route="/api/v1/notifications..."` (обрезано на границе буфера)

## Связь со spec

- R06/R23 (probes): базовые пробы зафиксированы; углубление
  (restart/resources/limits/queues) — operations-отчёт по тем же швам.
- Решение 4: лимит частоты соблюдён (4 одиночных GET); stop-сигнал не сработал.
- Ссылки: `01-environments.md` (Production probes).
