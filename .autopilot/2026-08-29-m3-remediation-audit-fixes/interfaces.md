# Interfaces — M3 remediation

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `backend/files` | file_ref validation + header CRLF | 404/422 + Content-Disposition filename* | PK/CRLF |
| `backend/throttle` | async Redis | 429 | sync |
| `backend/data` | migration 0031/0032 + read isolation | 0032 NOT NULL | NULL |
| `infra` | lock/digest/nginx | @sha256 + X-Request-ID | tag |
| `frontend/csp` | x-nonce removal | CSP | x-nonce |
| `observability` | ETag Vary + CVD const | Vary/private | magic |

Швы: `pytest 347→353`, `ruff/mypy`, `npm 39`, `security_check`, `loadtest`.
