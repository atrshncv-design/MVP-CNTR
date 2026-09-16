# Спецификация: M3 — Ремедиация аудита 2026-08-29 (8 спек, 17 тикетов)

## Задача
Реализовать полный комплект remediation из `docs/remediation/` (план, 8 спек, 17 тикетов) — закрыть 20 находок аудита (3H/7M/6L/4I) + EXT smoke, не ломая 347/39 gates.

## Решение
- SPEC-01 файловые заголовки: `projects.py:671` file_ref без bypass, `files.py:148` CRLF, `main.py:188` X-Request-ID regex, `storage.get` to_thread
- SPEC-02 async throttling: `auth_throttle.py:42` + `nioktr.py:46` to_thread, `is_blocked` async
- SPEC-03 данные: `0031` CASE + `0032` NOT NULL + `projects.py:508` read filter
- SPEC-04 supply chain: `uv lock` pin, `docker-compose.prod.yml` digest, `.gitignore`, `ИМПОРТОЗАМЕЩЕНИЕ.md`
- SPEC-05 observability: `achievements/news` ETag Vary/private, `nginx` X-Request-ID, CVD const
- SPEC-06 CSP: `next.config.ts` style ADR, `middleware.ts` x-nonce удалить
- SPEC-07 scheduler: ADR-0015, Dockerfile guard
- SPEC-08 тесты: 6+ remediation tests + EXT smoke

## Пользовательские истории

| # | Метка | История | Приёмка |
|---|-------|---------|---------|
| 1 | H-01 file_ref | любой непустой ref валидируется | `evil`→404, `ref-1` allowlist→201 |
| 2 | H-02b CRLF | заголовки без CRLF | `a\r\n` → генерит, не echo |
| 3 | M-06 to_thread | storage.get не блокирует loop | `to_thread` grep |
| 4 | H-02a throttle | login p95 <200ms при Redis down | async + gather 20 не блок |
| 5 | H-02a registry | nioktr 121 anon→429 | 121→429 |
| 6 | M-01 migration | `bad` →NULL, upgrade ok | dirty upgrade PASS |
| 7 | M-02 read | member only своё | A 90% B 30% isolation |
| 8 | H-03 lock | `uv.lock ==`, clean git | `git status` чистый |
| 9 | M-04 digest | `@sha256` в compose | grep 2 |
| 10 | M-05 nginx | X-Request-ID сквозь | `proxy_set_header` 3 |
| 11 | M-03 ETag | Vary/private | `Vary` + `private` |
| 12 | M-07 CSP | ADR-0014 | файл + коммент |
| 13 | L-01 x-nonce | удалён | grep 0 |
| 14 | L-03 CVD | единая const | `settings.cvd` |
| 15 | I-01 scheduler | ADR-0015 | файл + no workers |
| 16 | gaps | 6 тестов | 353+ PASS |
| 17 | EXT | prod smoke | `ready` 200 + reports |

## Границы и швы
| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `backend/files` | валидация file_ref/header | 404/422 | PK/CRLF |
| `backend/throttle` | async Redis | 429 | sync |
| `backend/data` | миграции isolation | 0031/0032 | NULL |
| `infra` | lock/digest/nginx | config | tag |
| `frontend/csp` | x-nonce | CSP | nonce |

Швы: `pytest 347→353`, `ruff/mypy`, `npm audit`, `security_check`.

## Вне рамок
- Замена `pymupdf` кодом (Q-03 — ADR до Q1)
- Вынос scheduler в sidecar (только ADR+guard)
- PROC-01/02 deferred

## Покрытие манифеста
| Требование | Раздел |
|---|---|
| R01 whole | 1..17 |
| R02 H-01 | 1 |
| R03 H-02b | 2 |
| R04 M-06 | 3 |
| R05 H-02a auth | 4 |
| R06 H-02a registry | 5 |
| R07 M-01 | 6 |
| R08 M-02 | 7 |
| R09 H-03 | 8 |
| R10 M-04 | 9 |
| R11 M-03 | 10 |
| R12 M-05 | 10 |
| R13 L-03 | 13 |
| R14 M-07 | 11 |
| R15 L-01 | 12 |
| R16 I-01 | 14 |
| R17 gaps | 15 |
| R18 EXT | 16 |
| R19 L-05 | 8 |
| R20 L-06 | 10 |
