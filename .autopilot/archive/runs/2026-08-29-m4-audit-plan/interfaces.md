# Interfaces — M4 audit plan (14 находок → 6 спек → 14 тикетов)

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `infra supply` | digest pinning + git hygiene | `clamav/clamav:1.4.3@sha256:75fb…` + `git status` 0 | placeholder `b443…` |
| `db/migrations` | идемпотентность 0031/0032 | `DO $$` без `pg_temp`, `DROP INDEX` downgrade | `pg_temp.try_cast_date` |
| `nginx` | X-Request-ID сквозной | `map regex ^[A-Za-z0-9._-]{8,64}$` + `tz_main` | `default` echo |
| `config/cvd` | единый TTL CVD | `CVD_MAX_AGE_SECONDS=604800` env → `settings`+alerter | дубль 7*24*3600 |
| `questionnaire` | staff avg | `GET /projects/{id}?all=1` все строк с `user_id`, без — `avg+count` | heavy 90k JSON |
| `technologies` | per-page кэш | `ETag` per `limit/offset` + `Vary` 304 | full-scan md5 |
| `files` | fallback | один `re.sub` | `.replace('"')` |
| `tests` | hygiene | dedup `*_remediation` only, guard `--workers` | дубли |
| `reports` | артефакты | `reports/loadtest_report.json` `all_targets_pass:true`, `pitr PASS` | `external_pending:null` |

Швы: `pytest 359`, `ruff/mypy`, `npm 39`, `security_check --base-url`, `loadtest 1K 99% p95`, `rehearse_pitr.sh`.
