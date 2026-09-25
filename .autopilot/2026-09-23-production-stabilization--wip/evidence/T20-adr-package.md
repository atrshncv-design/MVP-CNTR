# T20 — ADR-пакет открытых архитектурных решений

- Созданы девять предложенных, не принятых ADR: `docs/adr/0043-rls-tenant-isolation.md` … `docs/adr/0051-p2-feature-scope.md`.
- Все девять содержат семь обязательных разделов и статус `proposed — решение владельца требуется`; API, схема БД, runtime и production не менялись.
- Исправлены ревью-находки: различены публичный `GET /projects/registry` и gated client helper; P2-gate согласован; подтверждено, что matching уже открыт; HA описан как частичная отказоустойчивость с оставшимися SPOF; влияние ClamAV ограничено readiness/file path без заявления о полном простое; неизвестные сроки хранения не объявляются юридическим нарушением.
- Независимые проверки: Manifest/Spec reviewer — `clean`; Craft reviewer — `clean`; структурная проверка — 9/9 файлов, у каждого семь разделов и proposed status; trailing whitespace — чисто; `git diff --check` — exit 0.
- Кодовые suites не запускались: тикет docs-only, acceptance не требует code tests.
- Исполнитель: `opencode/space-bunny-free`, вариант `max`; две ограниченные repair-сессии, без коммита/пуша.
- Дата фиксации результата: `2026-09-25T20:36:01+04:00`.
