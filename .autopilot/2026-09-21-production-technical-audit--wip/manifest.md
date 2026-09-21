# Манифест требований

Источник: `2026-09-21-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | «Провести полный технический аудит недавно развёрнутого MVP» | in-ticket | spec → T01,T09 | T01,T09 |
| R02 | «функции локальной версии; фактическое состояние Git-репозитория; код и конфигурацию на сервере; работающие функции production; ожидаемое поведение» | in-ticket | spec → T01,T02 | T01,T02 |
| R03 | «Любое утверждение должно иметь доказательство» | in-ticket | spec → T01-T09 | T01-T09 |
| R04 | «Аудит и исправление — разные этапы» | in-ticket | spec → T09 | T09 |
| R05 | «Не вноси изменения в код или production до завершения аудита и отдельного одобрения» | in-ticket | spec → T09 | T09 |
| R06 | «До анализа зафиксируй» local/server SHA, manifests, runtime, services, config names, CI/CD, deploy, logs, backup, monitoring | in-ticket | spec → T01,T08 | T01,T08 |
| R07 | «Построй функциональную карту» routes, screens, APIs, jobs, integrations, flags, roles, tables, AI | in-ticket | spec → T02 | T02 |
| R08 | «Для каждой функции укажи статус» `EXPECTED` ... `UNKNOWN` и полную строку матрицы | in-ticket | spec → T02,T09 | T02,T09 |
| R09 | «Проверь» architecture, coupling, duplication, complexity, types, errors, retries, races, N+1, leaks, mutable state, hardcode, stubs, dead ends, tests, dependencies | in-ticket | spec → T03 | T03 |
| R10 | «Не называй код мёртвым только на основании текстового поиска» | in-ticket | spec → T02,T03 | T02,T03 |
| R11 | «Проверь» model, migrations, constraints, indexes, plans, retention, encryption, least privilege, network, tenant isolation, audit and deletion | in-ticket | spec → T04 | T04 |
| R12 | «Не выводи содержимое персональных данных» | in-ticket | spec → T04,T05,T07 | T04,T05,T07 |
| R13 | «Проверь» auth/session/password/recovery/MFA/RBAC/IDOR/CSRF/XSS/SSRF/injection/uploads/CORS/CSP/JWT/rate limits/secrets/supply chain/containers/admin/debug/errors | in-ticket | spec → T05 | T05 |
| R14 | «Права должны учитывать роль, владение проектом и приглашение» | in-ticket | spec → T04,T05 | T04,T05 |
| R15 | «Расчёт УГТ автоматический, переход ручной; организации и проекты верифицируются Центром» | in-ticket | spec → T05 | T05 |
| R16 | «Проведи браузерную проверку всех доступных экранов и ключевых состояний» | in-ticket | spec → T06 | T06 |
| R17 | «Каждый визуальный дефект подтверждай screenshot, viewport, URL, ролью, шагами» | in-ticket | spec → T06 | T06 |
| R18 | «UX viewports: 1920 / 768 / 375» | in-ticket | spec → T06 | T06 |
| R19 | «Снача создай полный реестр AI-функций» | in-ticket | spec → T07 | T07 |
| R20 | «Не делай вывод “AI работает” по успешному HTTP 200» | in-ticket | spec → T07 | T07 |
| R21 | «AI: до 200 запросов» с корпусом ГОСТов и без ПДн/чувствительных проектных данных | in-ticket | spec → T07 | T07 |
| R22 | «Для AI разрешены публично-технические поля»; denylist ПДн/договоров/бюджетов/ТЗ/вложений/комментариев/секретов | in-ticket | spec → T07 | T07 |
| R23 | «Проверь» deployment, probes, restart, limits, logs, monitoring, backup, restore, RPO/RTO, CI/CD, rollback, SPOF, Redis, PostgreSQL, queues | in-ticket | spec → T01,T08 | T01,T08 |
| R24 | «Нагрузка — только наблюдение» | in-ticket | spec → T01,T08 | T01,T08 |
| R25 | «Незапущенные функции не считать регрессией, если они скрыты и не создают риска» | in-ticket | spec → T02,T03,T05,T06,T07,T08 | T02,T03,T05,T06,T07,T08 |
| R26 | «Каждой находке назначай» ID, area, severity, confidence, environments, roles, effect, cause, evidence, reproduction, recommendation, effort, dependencies, risk, migration, downtime, acceptance | in-ticket | spec → T03-T09 | T03-T09 |
| R27 | «Подготовь» 16 обязательных результа аудита | in-ticket | spec → T09 | T09 |
| R28 | «Заверши аудит gate-решением: GO; GO WITH CONDITIONS; NO-GO» | in-ticket | spec → T09 | T09 |
| R29 | «Создавай тикеты только после согласования findings и приоритетов» | deferred | spec «Вне рамок»: требует отдельного согласования или входных данных | spec «Вне рамок» |
| R30 | «Phase 5 выполняй только через установленный адаптер Autopilot–OpenCode» | in-ticket | сквозной execution-контракт → T01-T09 | T01-T09 |
| R31 | «OpenCode — opencode-go/muse-spark-1.3-contributor» | in-ticket | сквозной execution-контракт → T01-T09 | T01-T09 |
| R32 | «Реестры полностью аудитировать, но не исправлять» | in-ticket | spec → T02,T09 | T02,T09 |
| R33 | «API-реестры, открытые поля проектов/участников и анкеты потенциала» — отдельный будущий прогон | deferred | spec «Вне рамок»: требует отдельного согласования или входных данных | spec «Вне рамок» |
| R34 | «В репозитории сохранить» Markdown + JSON/CSV + screenshots + architecture/risk/backlog/unknowns | in-ticket | spec → T09 | T09 |
| R35 | «Локально прогнать backend tests, Ruff, mypy, frontend tests и production build» | in-ticket | spec → T03 | T03 |
| R36 | «Авторизованные ролевые сценарии отложить до отдельного безопасного создания тестовых аккаунтов» | deferred | spec «Вне рамок»: требует отдельного согласования или входных данных | spec «Вне рамок» |
| R37 | «Не запрашивай пароли, токены или приватные ключи» | in-ticket | spec → T01 | T01 |
