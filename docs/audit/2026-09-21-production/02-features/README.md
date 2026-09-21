# 02 — Функциональная карта и перенос (ticket 02)

Полная inventory — `inventory-backend.md` (26 роутеров, 36 таблиц, задачи, роли,
флаги, интеграции, webhooks, AI) и `inventory-frontend.md` (landing/auth/
dashboard-сегменты, компоненты, клиент, офлайн). Матрица переноса —
`feature-matrix.csv` (33 строки F-001…F-033). Граница MVP и dead-code —
`mvp-scope.md`.

## Семантика статусов (только из закрытого списка spec, Решение 8)

- `DEPLOYED_WORKING` — только при прямом EV-доказательстве: F-001…F-004 (EV-004,
  все 200). Больше нигде deployed не заявлен (Решение 7).
- `EXPECTED` — MVP-скоуп, реализация есть статически (EV-001), production-проба
  отсутствует или auth-gated: F-005…F-027, F-031, F-032.
- `STUB` — задекларированные заглушки/плейсхолдеры: F-028, F-029, F-033.
- `DISABLED` — выключено флагом по умолчанию: F-030 (`LLM_GATEWAY_ENABLED`).
- `UNKNOWN` — в колонке `production_check` везде, где проба невозможна без
  test accounts или safe-сценария (R36); `server_implementation` честно помечена
  как lineage без пофайлового диффа.
- `LOCAL_ONLY` / `SERVER_ONLY` / `DEPLOYED_BROKEN` / `PARTIALLY_DEPLOYED` —
  не использованы: ни одно из этих утверждений недоказуемо на имеющихся EV.

## Связь с evidence

Каждая строка матрицы несёт `evidence_ids` (EV-001…EV-007 по применимости);
пустых нет. Сырые тела/логи не сохранялись; секреты — только именами.
Перекрёстные факты ticket 01 переиспользованы: `server-path-differs-from-spec`,
`deploy-log-trail-behind-running`, `replica not_configured`.
