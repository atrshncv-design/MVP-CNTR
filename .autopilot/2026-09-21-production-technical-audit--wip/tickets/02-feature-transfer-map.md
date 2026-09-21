# 02 — Функциональная карта и перенос

**Требования:** R02, R03, R07, R08, R10, R25, R30–R32
**Blocked by:** 01
**Зона:** `docs/audit/2026-09-21-production/02-features/`
**Волна:** 2
**Status:** ready

## Что должно заработать

Полная inventory routes/screens/components/APIs/jobs/cron/integrations/webhooks/flags/roles/tables/AI и CSV-матрица, сопоставляющая expected/local/server/production. Реестры проверяются полностью, но не меняются.

## Из брифа, дословно

> «Построй функциональную карту»
> «Реестры полностью аудитировать, но не исправлять»

## Разделы спецификации

История 2; схема `feature-matrix.csv`; границы MVP.

## Критерии приёмки

- [ ] CSV валиден, имеет точную spec-схему и только разрешённые статусы.
- [ ] Frontend/backend/DB/background/integration/AI inventory не содержит недоказанных deployed-утверждений.
- [ ] MVP planned/in-development отделён от regression; dead code не заявлен по одному grep.
- [ ] У каждой строки есть evidence IDs или `UNKNOWN`.
