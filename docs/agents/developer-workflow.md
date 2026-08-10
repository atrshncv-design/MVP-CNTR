# Workflow модели-разработчика

Канонический reusable prompt находится в `.scratch/week-release-rc/developer-prompt.md`.

## Передача работы

1. Оркестратор выбирает один frontier ticket, блокеры которого имеют `Status: done`.
2. Для тикета создаётся отдельный worktree и ветка `codex/<ticket-slug>`.
3. Модель получает только мастер-промпт с одним `<TICKET_PATH>`.
4. Модель заканчивает на `Status: ready-for-review` без commit/push.
5. Оркестратор проверяет diff, acceptance, тесты, security и рефакторинговый дрейф.
6. При принятии оркестратор ставит `Status: done`, обновляет `Status.md`, создаёт атомарный commit и push.
7. При отклонении тот же тикет исправляется в свежем контексте с приложенным диагностическим отчётом; одна повторная попытка.

## Frontier первого этапа

Начальный и единственный тикет: `.scratch/repo-hygiene/issues/01-inventory.md`.

После его принятия открывается `02-canonical-layout.md`; никакие feature-пакеты не стартуют до clean-clone gate и release-audit baseline.
