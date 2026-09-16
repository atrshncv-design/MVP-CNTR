# Манифест требований

Источник: `2026-08-26-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | «закрыть критические дыры безопасности… — N-01 (обход модерации вступления)» | done | объём подтверждён владельцем: «Полный гейт G1»; коммит 32b3985 | T01 |
| R02 | «FE-01 (fail-open матрица ролей фронта + регрессионный тест)» | done | объём подтверждён владельцем: «Полный гейт G1»; коммит 0a94ba1 | T02 |
| R03 | «FE-02 (localhost-fallback прода, единый API-URL)» | done | объём подтверждён владельцем: «Полный гейт G1»; коммиты 0a94ba1, 7f6ad43; fail-fast/rewrite tests | T02 |
| R04 | «CI-пайплайн (P-12)» | code/local done; external pending | workflow и локальные gates зелёные; baseline-коммит 4e570d0, поздние repair-изменения dirty/uncommitted; remote GitHub Actions не проверен | T06 |
| R05 | «техтребования к серверу заказчика (одностраничная спецификация: ОС, Docker, CPU/RAM/disk, исходящий доступ, их бэкапы)» | done | объём подтверждён владельцем: «Полный гейт G1»; коммит 8c065b7 | T03 |
| R06 | «оценку текущего стека на импортозамещение» | done | объём подтверждён владельцем: «Полный гейт G1»; коммит 8c065b7 | T03 |
| R07 | «ВСЕ пункты уровня P0 реестра docs/BACKLOG.md» → INF-01: расписание бэкапов | code/local done; external pending | baseline aa783b6; поздняя infra-repair цепочка dirty/uncommitted, focused tests green; production scheduled-backup evidence pending | T04 |
| R08 | «ВСЕ пункты уровня P0» → INF-02: WAL/PITR, «восстановление отрепетировано» | code/local done; external pending | локальная репетиция и dev replication smoke пройдены; production-like PITR/offsite evidence pending; dirty repairs не покрыты aa783b6 | T04 |
| R09 | «ВСЕ пункты уровня P0» → INF-03: max_slot_wal_keep_size | code/local done; external pending | конфигурация и focused checks зелёные; production deployment/monitoring evidence pending; dirty repairs uncommitted | T04 |
| R10 | «ВСЕ пункты уровня P0» → INF-04: offsite-копия бэкапов | code/local done; external pending | crypt-only code path and focused checks green; нужен operator crypt remote/config и live offsite evidence | T04 |
| R11 | «ВСЕ пункты уровня P0» → INF-05: алерты (Telegram) | code/local done; external pending | alerter 28 passed; Telegram delivery requires operator configuration and live smoke; dirty repairs uncommitted | T05 |
| R12 | «ВСЕ пункты уровня P0» → INF-06: health-gate и rollback в deploy.sh | code/local done; external pending | shell/config and focused checks green; production deploy and rollback live smoke pending | T05 |
| R13 | «ВСЕ пункты уровня P0» → INF-07: Grafana внутрь контура | code/local done; external pending | configuration reviewed locally; production deployment/access verification pending | T05 |
| R14 | «ВСЕ пункты уровня P0» → P-01: пул БД согласован с max_connections | done | объём подтверждён владельцем: «Полный гейт G1»; коммит 32b3985 | T01 |
| R15 | «ВСЕ пункты уровня P0» → N-02: ревок refresh при смене пароля + logout | done | объём подтверждён владельцем: «Полный гейт G1»; коммит 32b3985 | T01 |
| R16 | «ВСЕ пункты уровня P0» → N-04: лимит загрузки stage-document-file + chunked-bypass | done | объём подтверждён владельцем: «Полный гейт G1»; коммит 32b3985 | T01 |
| R17i | *(подразумевается)* каждый фикс закрыт тестом, gates зелёные (Definition of Done из Plan.md §7) | code/local done; external pending | backend 334 passed (single process), frontend 39 passed + lint/build, ruff/mypy and audits green; focused infra tests green. Remote CI and production evidence pending; dirty repairs are not covered by existing commits | все таски (DoD) |
| R18 | «работа ведётся на ветке autopilot/m0-security-hardening от актуального main; merge в main — после приёмки владельцем» | in-spec | ограничение процесса, не код | spec §Процесс |
| R19d | 3) «E2E-автотест демо-маршрута начать в октябре… — вне рамок этого прогона» | deferred | фаза M2 плана, октябрь | Out of Scope |
| R20d | 4) «учения „суббота вечером" раз в месяц после G2 — вне рамок этого прогона» | deferred | церемония после G2 | Out of Scope |
| R21d | 5) «тест bus-factor в ноябре — вне рамок этого прогона» | deferred | ноябрь, G3-период | Out of Scope |
