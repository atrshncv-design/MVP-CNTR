# SLA/SLO/RPO/RTO — нужно ли платить, ресурсы

## Нужно ли платить за метрики сами
Нет, SLA/SLO — цифры в docs/СЕРВЕР-ТРЕБОВАНИЯ.md, бесплатно. Платишь за железо чтобы их достичь:

- RPO 5м: WAL-archive том 200 ГБ + wal-offsite sidecar (1 vCPU 1ГБ) — включено в 84 ГБ 5К
- RTO 1ч: base backup + PITR репетиция, без доп железа
- 99.9%: второй хост + alerter Telegram + health-gate deploy.sh:60 — +1 хост 32 ГБ (из 84 vs 52)
- p95 500мс: pgbouncer 2 ГБ + Replica 16 ГБ + GIN индексы P-05 (без доп RAM)

Итого SLA 99.9% = 77к/мес vs без SLA 18к (пилот) — доплата за HA, не за бумагу.

## 1М+ карточек — ресурсы
Сейчас 16k, 1М = x62. Монолит с индексами держит 500k, дальше:
- PG Primary 16/64 -> 32/128 (shared_buffers 32ГБ) + Replica 16/64 -> 32/128
- Партиционирование nioktr_cards по sector/region (declarative partitioning) + read Replica
- 5К RPS: 84 ГБ -> 140 ГБ (2 хоста -> 3)
- RAG vector 1М x1536 ~6 ГБ + ivfflat lists 1000

Без шардирования 1М на 84 ГБ — seq scan P-06 убьет p95.
