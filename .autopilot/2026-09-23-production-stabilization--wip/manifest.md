# Манифест требований

Источник: `2026-09-23-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | «ознакомиться с результатами завершённого production-аудита» | in-spec | spec §Контекст | — |
| R02 | «превратить подтверждённые findings в исполнимые задачи» | in-spec | spec §Решение/Трассировка | — |
| R03 | «реализовать необходимые изменения для достижения целевого состояния MVP» | in-spec | spec §Волны | — |
| R04 | «Работай только в отдельном git worktree и новой ветке. Не изменяй `main` напрямую» + «Рекомендуемая ветка: autopilot/production-stabilization» | done | T01: branch autopilot/production-stabilization @ 83d3c9b, worktree .worktrees/production-stabilization | 37a4340 |
| R05 | «Сначала выполни: `python3 docs/audit/2026-09-21-production/09-final/check_final.py`» | in-ticket | T02 backend гейты: Ruff PASS, mypy BLOCKED, pytest FAIL; T03/T04 ещё впереди | `evidence/T02-verification.md` |
| R06 | «Не считай локальный код, audit finding или старую документацию автоматически правильными» + «Не превращай `UNKNOWN` в утверждение без нового доказательства» | in-spec | spec §Доказательства | — |
| R07 | «Доведи MVP до технически стабильного состояния, пригодного для ограниченной эксплуатации и последующего масштабирования» + 10 критических пунктов (публичный контур; регистрация и аутентификация; кабинеты и роли; жизненный цикл техпроекта; безопасность доступа; расчёт и переходы УГТ; ручная верификация; хранение/восстановление; управляемые AI/RAG; зелёные CI/CD-гейты) | in-spec | spec §DoD | — |
| R08 | «Доступ к проекту определяется одновременно ролью, владением и приглашением» | in-spec | spec §Продуктовые правила | — |
| R09 | «Нельзя получать доступ к чужому проекту через подбор идентификаторов, изменение URL или API-параметров» | in-spec | spec §Продуктовые правила | — |
| R10 | «УГТ рассчитывается автоматически» + «Официальный переход проекта между уровнями УГТ подтверждает сотрудник Центра» | in-spec | spec §Продуктовые правила | — |
| R11 | «Организации и проекты проходят ручную верификацию» | in-spec | spec §Продуктовые правила | — |
| R12 | «Публичная витрина не должна раскрывать закрытые, непроверенные или чувствительные сведения» | in-spec | spec §Продуктовые правила | — |
| R13 | «Реестры должны быть проверены на безопасность и корректность, но расширение их состава выполняй только при наличии утверждённой схемы полей» | in-spec | spec §Продуктовые правила | — |
| R14 | «Разные анкеты потенциала вузов и промышленных предприятий не проектируй в этой задаче» | deferred | spec «Вне рамок»: отдельный будущий этап | — |
| R15 | «Не реализуй скрытые плановые возможности только ради удаления статуса `STUB`» | deferred | spec «Вне рамок»: запрещено без утверждения MVP-состава | — |
| R16 | «ПДн, договоры, бюджеты, вложения, внутренние комментарии и коммерческие тайны нельзя отправлять внешним AI-провайдерам» | in-spec | spec §AI | — |
| R17 | «C1 — offsite backup» (REMOTE через штатный secret-механизм, без секретов в Git/логах, свежий marker, retention/устаревание, alert при сбое) | in-spec | spec §C1/C2 | — |
| R18 | «C2 — restore proof» (только staging/изоляция, дата+ID backup, схема+данные, integrity/smoke, RTO/RPO, rehearsal-отчёт; скрипт ≠ доказательство) | in-spec | spec §C1/C2 | — |
| R19 | «C3 — авторизованные сценарии» (role matrix после safe accounts; до этого BLOCKED/UNKNOWN; production-пользователей не создавать без разрешения) | in-spec | spec §C3 | — |
| R20 | «C4 — топология и зелёные гейты» (воспроизводимое окружение, зелёные backend/frontend/CI, решение SPOF / план HA) | in-ticket | T02 backend gate не зелёный (705/15); T03/T04/T20 не запускались | `evidence/T02-verification.md` |
| R21 | «Волна 0 — воспроизводимость и baseline» (изолированный worktree, SHA/status, версии, локальное окружение, `uv sync --locked --extra dev`, устранить CODE-03/CODE-06, честный baseline, без `\| tail`/`\|\| true`; гейты ruff/mypy/pytest/npm test/build; тесты только в test schema, никогда в production) | in-ticket | T02: sync/Ruff PASS; mypy BLOCKED; pytest FAIL; T03/T04 не запускались | `evidence/T02-verification.md` |
| R22 | «Волна 1 — P0 и условия GO» (OPS-02/OPS-03/CODE-03/CODE-06/OPS-01+DB-05/C3; инфра-план на production только как change plan с подтверждением владельца) | in-spec | spec §Волна 1 | — |
| R23 | «Волна 2 — P1» (SEC-01, AI-01, DB-04, DB-05, CODE-01, CODE-02; для каждого — тест, доказывающий устранение) | in-spec | spec §Волна 2 | — |
| R24 | «Волна 3 — безопасные quick wins» (UX-01, SEC-02, SEC-03, AI-02, CODE-04; DB-03 — docs+проверка индексов) | in-spec | spec §Волна 3 | — |
| R25 | «Волна 4 — остальные решения» (RLS, soft delete, MFA, TTL/blocklist, zero-downtime, реестры, анкеты, P2, HA — только ADR без реализации при отсутствии решения) | in-spec | spec §Волна 4/ADR | — |
| R26 | «AI/RAG управляемые, наблюдаемые и безопасные» (injection/tenant/grounding/citations/validation/timeout/retry/concurrency/per-route rate/quota/budget/breaker/fallback/метрики/staleness/chunking overlap/без чувствительных данных; live eval ≤200, ГОСТы+синтетика, dataset/метрики/stop, счётчик; allowlist 7 полей) | in-spec | spec §AI | — |
| R27 | «Правила реализации» (evidence→repro→минимум→failing test→fix→focused→regression→ревью→docs→атомарный commit→push в origin; без смешивания/рефакторинга; API/схема только с миграцией; Alembic upgrade/downgrade, test schema, ORM; finding закрыт только с тестом и доказательством) | in-spec | spec §Процесс | — |
| R28 | «Безопасность production» (запреты без разрешения; только read-only + редкие smoke; стоп при 5xx/unhealthy/latency/записи/утечке; без вывода `.env`/keys/токенов/PII/проектов) | in-spec | spec §Процесс | — |
| R29 | «Definition of Done» (P0; C1–C4 с доказательствами; ruff/mypy/tests/build/CI green; smoke+ролевые или BLOCKED; нет IDOR/BOLA; ownership/invitation тестами; УГТ авто+переход сотрудником; верификация тестами; offsite+restore+RPO/RTO; AI controls; registry обновлён; docs соответствуют; все commits в origin; prod не тронут) | in-spec | spec §DoD | — |
| R30 | «Требуемые артефакты» (implementation plan, тикеты, traceability, журнал решений, ADR, отчёты тестов, security regression, role matrix, AI eval, backup evidence без секретов, restore rehearsal, RPO/RTO, updated registry, UNKNOWN, acceptance report, GO/CONDITIONS/NO-GO) | in-spec | spec §Артефакты | — |
| R31 | «В первом ответе предоставь» (подтверждение прочтения; понимание результата; таблица findings 5 групп; атомарные тикеты по порядку; зависимости; локальные vs требующие разрешения; данные/safe accounts; что из C1–C4 без воздействия на prod) + «Не начинай с изменений production» | in-spec | spec §Артефакты | — |
| R32 | «Фактический deployment path необходимо подтвердить read-only проверкой: `/opt/technozrelost`, но аудит обнаружил `~/MVP-CNTR`» | in-spec | spec §Воспроизводимость | — |
| R33 | «Под AI функциями я имел в виду работу ИИ-ассистентов по документам и по реестрам» | in-ticket | spec §Уточнение AI; T23/T24 — отдельные сквозные проверки | — |
| R34 | «там ключ устарел, я добавлю новый - от другой модели, но уже после доработки всех текущих правок» | deferred | Новый ключ предоставляет владелец после локальных исправлений; live provider gate до этого BLOCKED | — |
| R35 | «Давай отбросим сейчас opencode и поработаем в codex… модель для написания кода и реализации тасков теперь будет не muse spark, а gpt luna 6 high» | done | Codex T22 запущен на `gpt-6-luna`/high; spec §Уточнение исполнения | state.js T22 |
| G01 | «Немедленно изолируй работу… Создай отдельные: branch autopilot/production-stabilization; worktree; Autopilot run production-stabilization» | done | T01: inventory выполнен, база 83d3c9b доказана сравнением веток, worktree+branch созданы | 37a4340 |
| G02 | «Не изменяй материалы завершённого аудита… Для стабилизации создай отдельные: findings status registry; traceability matrix; implementation evidence; acceptance report» | in-spec | spec §Контекст | — |
| G03 | «Сделай тикеты действительно атомарными» (T01–T21, по одному finding/изменению) | in-spec | spec §Волны | — |
| G04 | «Не начинай с P1» (порядок: T01 → T02–T04 → baseline → T05–T12 → regression → T13–T18 → change plans → T19 → T21) | in-spec | spec §Волны | — |
| G05 | Разрешены: worktree/ветка, зависимости по lock-файлам, `uv sync --locked --extra dev`, `npm ci`, локальная test DB, локальные тесты/линт/build, локальные тикеты, commits+push в новую ветку; production-запреты сохранены | in-spec | spec §Процесс | — |
| G06 | «C1/C2 не симулируй… оставляй READY FOR APPROVAL, а не DONE» | in-spec | spec §C1/C2 | — |
| G07 | «C3: локальные RBAC/ownership/invitation/IDOR-тесты + matrix + plan; runtime BLOCKED, аккаунты не создавать» | in-spec | spec §C3 | — |
| G08 | «Архитектурные решения: RLS, soft delete, MFA, blocklist, HA/failover, zero-downtime, реестры, анкеты, P2 — только ADR» | in-spec | spec §Волна 4/ADR | — |
| G09 | «Исполнитель и оркестратор»: spec/тикеты — оркестратор; implementation — новая OpenCode-сессия; исполнитель не меняет spec/manifest/dashboard/статусы и не коммитит; модель не менять без разрешения | in-spec | spec §Процесс | — |
| D01 | Обнаружено в T02: 15 тестов падают, потому что четыре `_fake_ok_llm` не принимают `session_id`, передаваемый `stages.py` | in-ticket | T22: восстановить тестовый контракт без изменения продуктового кода; затем повторить T02 gate | `evidence/T02-verification.md` |
