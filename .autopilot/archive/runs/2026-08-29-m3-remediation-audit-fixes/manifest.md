# Манифест требований

Источник: `2026-08-29-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | «Приступай к реализации плана, спек и тикетов» — весь комплект remediation 8 спек 17 тикетов | in-ticket | — | spec §1 → T01..T17 |
| R02 | SPEC-01 H-01 file_ref bypass без “/” | in-ticket | аудит H-01 | spec SPEC-01 → T01 |
| R03 | SPEC-01 H-02b CRLF X-Request-ID + Content-Disposition | in-ticket | аудит H-02b | SPEC-01 → T02 |
| R04 | SPEC-01 M-06 storage.get sync в async | in-ticket | аудит M-06 | SPEC-01 → T10 |
| R05 | SPEC-02 H-02a sync Redis auth throttle | in-ticket | аудит H-02a | SPEC-02 → T03 |
| R06 | SPEC-02 H-02a sync Redis registry limit | in-ticket | аудит H-02a | SPEC-02 → T04 |
| R07 | SPEC-03 M-01 migration 0031 падает на мусоре | in-ticket | аудит M-01 | SPEC-03 → T06 |
| R08 | SPEC-03 M-02 read leak анкеты | in-ticket | аудит M-02 | SPEC-03 → T07 |
| R09 | SPEC-04 H-03 dirty uv.lock | in-ticket | аудит H-03 | SPEC-04 → T05 |
| R10 | SPEC-04 M-04 digest pinning | in-ticket | аудит M-04 | SPEC-04 → T08 |
| R11 | SPEC-05 M-03 ETag Vary/private | in-ticket | аудит M-03 | SPEC-05 → T11 |
| R12 | SPEC-05 M-05 nginx X-Request-ID forwarding | in-ticket | аудит M-05 | SPEC-05 → T09 |
| R13 | SPEC-05 L-03 CVD дублирование | in-ticket | аудит L-03 | SPEC-05 → T14 |
| R14 | SPEC-06 M-07 style-src unsafe-inline ADR | in-ticket | аудит M-07 | SPEC-06 → T12 |
| R15 | SPEC-06 L-01 x-nonce мёртвый | in-ticket | аудит L-01 | SPEC-06 → T13 |
| R16 | SPEC-07 I-01 scheduler в процессе | in-ticket | аудит I-01 | SPEC-07 → T15 |
| R17 | SPEC-08 testing gaps 6+ тестов | in-ticket | аудит sec9 | SPEC-08 → T16 |
| R18 | SPEC-08 EXT-01 P0 внешние smoke | in-ticket | аудит EXT-01 | SPEC-08 → T17 |
| R19 | L-05 ИМПОРТОЗАМЕЩЕНИЕ.md pymupdf | in-ticket | аудит L-05 | SPEC-04 → T05 |
| R20 | L-06 technologies без кэша | in-ticket | аудит L-06 | SPEC-05 → T11 |
