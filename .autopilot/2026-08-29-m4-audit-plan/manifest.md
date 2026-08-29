# Манифест требований — M4 план ремедиации аудита 2026-08-29

Источник: `2026-08-29-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | Подготовить полный комплект спецификаций и тикетов для исправления всех найденных ошибок (14 находок аудита) без потери замечания | in-spec | бриф M4 | spec §1 → SPEC-01..06 → TICKET-01..14 |
| R02 | H-01 clamav digest placeholder → реальный digest | in-spec | аудит H-01 | SPEC-01 → TICKET-01 |
| R03 | H-02 0031 pg_temp.try_cast_date падает в пуле | in-spec | аудит H-02 | SPEC-02 → TICKET-03 |
| R04 | M-01 nginx X-Request-ID без regex map | in-spec | аудит M-01 | SPEC-03 → TICKET-05 |
| R05 | M-02 CVD дублирование константы | in-spec | аудит M-02 | SPEC-04 → TICKET-06 |
| R06 | M-03 staff read leak heavy JSON / avg | in-spec | аудит M-03 | SPEC-05 → TICKET-08 |
| R07 | M-04 external smoke stubs (loadtest/pitr/security --base-url) | in-spec | аудит M-04 | SPEC-06 → TICKET-14 |
| R08 | M-05 git status dirty не запушен (push-контракт) | in-spec | аудит M-05 | SPEC-01 → TICKET-02 |
| R09 | L-01 дубли тестов storage/throttle | in-spec | аудит L-01 | SPEC-06 → TICKET-11 |
| R10 | L-02 fallback двойная замена кавычек | in-spec | аудит L-02 | SPEC-05 → TICKET-10 |
| R11 | L-03 0032 downgrade оставляет индексы | in-spec | аудит L-03 | SPEC-02 → TICKET-04 |
| R12 | L-04 .gitignore reports в корне не игнорит | in-spec | аудит L-04 | SPEC-01 → TICKET-13 |
| R13 | I-01 scheduler guard только коммент | in-spec | аудит I-01 | SPEC-06 → TICKET-12 |
| R14 | I-02 technologies ETag без пагинации O(N) | in-spec | аудит I-02 | SPEC-05 → TICKET-09 |
| R15 | I-03 SOPS placeholder age | in-spec | аудит I-03 | SPEC-04 → TICKET-07 |
| R16 | Карта «проблема → спека → тикет» + граф зависимостей | in-spec | бриф §2/5 | PLAN-M4.md §4/7 |
| R17 | 6 спек по структуре (контекст/цель/FR/NFR/техрешение/сценарии/безопасность/тесты/приёмка/DoD) | in-spec | бриф §3 | specs/SPEC-01..06.md |
| R18 | 14 атомарных тикетов по структуре (проблема/результат/объём/не входит/компоненты/план/границы/тесты/приёмка/команды/риски) | in-spec | бриф §4 | tickets/TICKET-01..14.md |
| R19 | Этапы P0..P3 + порядок + условия завершения | in-spec | бриф §5 | PLAN-M4.md §8 |
| R20 | Самопроверка полноты + риски после плана | in-spec | бриф §6/10 | PLAN-M4.md §9/10 |
