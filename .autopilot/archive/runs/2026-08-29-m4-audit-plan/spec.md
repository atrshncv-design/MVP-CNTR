# Спецификация: M4 — План устранения аудита 2026-08-29 (14 находок, 6 спек, 14 тикетов)

## Задача
Преобразовать 14 находок аудита M3 (2 High, 5 Medium, 4 Low, 3 Info) в реалистичный план `docs/remediation-m4/` — 6 спек + 14 тикетов — чтобы другой агент реализовал исправления без доизучения проекта. Не менять код на этом этапе, не перезаписывать `docs/remediation/` M3.

## Решение
- SPEC-01 supply-chain: `TICKET-01` clamav официал digest + `TICKET-02` git hygiene push + `TICKET-13` .gitignore reports root
- SPEC-02 migrations: `TICKET-03` 0031 без pg_temp + `TICKET-04` 0032 downgrade индексы
- SPEC-03 nginx: `TICKET-05` X-Request-ID regex map
- SPEC-04 config: `TICKET-06` CVD единый env + `TICKET-07` SOPS доку
- SPEC-05 questionnaire/etag: `TICKET-08` staff avg+all, `TICKET-09` technologies per-page ETag, `TICKET-10` fallback dedup
- SPEC-06 external/tests: `TICKET-11` dedup tests + `TICKET-12` scheduler guard + `TICKET-14` external smoke 6 шагов ADR-0016

## Пользовательские истории

| # | Метка | История | Приёмка |
|---|-------|---------|---------|
| 1 | H-01 digest | `docker pull` детерминирован | grep `@sha256` 2, inspect RepoDigest совпадает |
| 2 | M-05 hygiene | `git status` чистый, origin pushed | `git status --porcelain` 0 |
| 3 | H-02 migration | dirty 0031 не падает в пуле | `test_migration_remediation` PASS, concurrent ×2 PASS |
| 4 | L-03 downgrade | `downgrade 0032` обратим | `DROP INDEX IF EXISTS` в downgrade |
| 5 | M-01 nginx | X-Request-ID сквозной с regex | `short` → 32hex, `Valid_123` echo, `nginx -t` PASS |
| 6 | M-02 CVD | единый `CVD_MAX_AGE_SECONDS` | env 604800 везде |
| 7 | I-03 SOPS | pilot 0600, B2G SOPS доку | `docs/SOPS.md` обновлён |
| 8 | M-03 questionnaire | staff avg по умолчанию | `admin GET` avg 60, `?all=1` 2 строки |
| 9 | I-02 technologies | ETag per page | `limit=2` ETag page-scoped, 304 per page |
| 10 | L-02 fallback | один `re.sub` | grep `replace('"'` 0 |
| 11 | L-01 dedup | нет дублей | `collect` 359 (-2 dub) |
| 12 | I-01 guard | CI ловит `--workers` | `grep --workers` fail |
| 13 | L-04 ignore | `reports/*.json` игнор, `pitr-*.txt` нет | `git check-ignore` true/false |
| 14 | M-04 external | прод-клон 6 шагов PASS | `reports/loadtest_report.json` `all_targets_pass:true` |

## Границы и швы
| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `infra` supply | digest/hygiene | `@sha256` + clean git | placeholder |
| `db/migrations` | идемпотентность | `DO $$` без pg_temp | `pg_temp` |
| `nginx` | трассировка | `map regex` + `tz_main` | `default` |
| `config/cvd` | единый env | `CVD_MAX_AGE_SECONDS` | дубль |
| `questionnaire` | staff avg | `?all=1` + `user_id` | heavy JSON |
| `technologies` | per-page ETag | `Vary` 304 per page | full-scan |
| `tests` | hygiene | dedup + guard | дубль |

Швы: `pytest 361→359`, `ruff/mypy`, `npm test 39`, `security_check --base-url`, `loadtest 1K`, `rehearse_pitr.sh`.

## Вне рамок
- Замена `pymupdf` (Q-03 keep until Q1, см. `ИМПОРТОЗАМЕЩЕНИЕ.md`)
- Вынос scheduler в `clock` sidecar beyond guard (P3 future)
- Postgres Pro / Astra миграция (отдельный трек)

## Покрытие манифеста
| Требование | Раздел |
|---|---|
| R01 whole | 1..14 |
| R02 H-01 | SPEC-01 → TICKET-01 |
| R03 H-02 | SPEC-02 → TICKET-03 |
| R04 M-01 | SPEC-03 → TICKET-05 |
| R05 M-02 | SPEC-04 → TICKET-06 |
| R06 M-03 | SPEC-05 → TICKET-08 |
| R07 M-04 | SPEC-06 → TICKET-14 |
| R08 M-05 | SPEC-01 → TICKET-02 |
| R09 L-01 | SPEC-06 → TICKET-11 |
| R10 L-02 | SPEC-05 → TICKET-10 |
| R11 L-03 | SPEC-02 → TICKET-04 |
| R12 L-04 | SPEC-01 → TICKET-13 |
| R13 I-01 | SPEC-06 → TICKET-12 |
| R14 I-02 | SPEC-05 → TICKET-09 |
| R15 I-03 | SPEC-04 → TICKET-07 |
| R16 map/graph | PLAN-M4 §4/7 |
| R17 6 specs | specs/SPEC-01..06 |
| R18 14 tickets | tickets/TICKET-01..14 |
| R19 stages | PLAN-M4 §8 |
| R20 completeness | PLAN-M4 §9/10 |
