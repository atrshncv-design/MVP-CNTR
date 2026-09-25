# T09 — CODE-04 production/dev configuration matrix

## Evidence

No real `.env`, credentials, or secret store was read. Only code defaults/examples and source locations are recorded; actual runtime values were not read:

| Key | Dev default/example | Production Compose/example | Existing guard | Consumer and conclusion |
|---|---|---|---|---|
| `APP_ENV` | `config.py:14` defaults to dev; `.env.example:2` lists it | `docker-compose.prod.yml:189` explicitly sets production | `config.py:108-139` gates production-only requirements | Drives production guard; explicit in standard production Compose. |
| `APP_HOST` | `config.py:16` defaults to `0.0.0.0`; `.env.example:4` | Not overridden by production Compose | None needed for this bind address | `app/main.py:360`; wildcard bind is intentionally valid and not loopback. |
| `POSTGRES_HOST` | `config.py:23` defaults to `127.0.0.1`; `.env.example:14` | `docker-compose.prod.yml:196` sets `db` for backend (also for DB-side service consumers at 319/426) | No dedicated loopback validator; production Compose overrides the default | `config.py:150-153` builds the DSN; standard Compose route does not use localhost. |
| `CORS_ORIGINS` | `config.py:72` defaults to localhost; `.env.example:34` lists the key | `docker-compose.prod.yml:199` takes it from the deployment environment; `infra/.env.production.example:51` documents the key | No host-specific guard | `app/main.py:300`; standard Compose does not fall back to the code default. Actual deployed value remains unknown. |
| `MINIO_ENDPOINT` | `config.py:92` defaults to `127.0.0.1:9000` | `docker-compose.prod.yml:211` sets `minio:9000` (also line 327 for another consumer) | No endpoint-specific loopback validator | `app/services/file_storage.py:232`; production Compose overrides the dev default. |
| `CLAMAV_HOST` | `config.py:97` defaults to `127.0.0.1` | `docker-compose.prod.yml:217` sets `clamav`; `infra/.env.production.example:145` documents the alerter-side key separately | No host-specific loopback validator | `app/services/file_storage.py:192,327` and `app/api/v1/health.py:76`; production Compose overrides the dev default. |

`infra/.env.production.example` contains the `CORS_ORIGINS` name and intentionally does not ask the operator to configure service DNS names; those are fixed to internal Compose service names in `docker-compose.prod.yml`. `MINIO_ENDPOINT`/`CLAMAV_HOST` have no deployment-time override in that Compose file.

## Finding decision

CODE-04's specific localhost/loopback escape was **not reproduced through the repository's standard production Compose path**: every backend service endpoint with a loopback dev default is explicitly replaced by an internal service name, while `APP_HOST=0.0.0.0` is the valid bind address. No product code change is justified by the current evidence. Existing production secret/Redis guards remain unchanged.

This is not proof of the running server's environment: no production contact or `.env` inspection occurred. Actual deployed values remain **UNKNOWN**. Reopen CODE-04 if deployment evidence shows a non-Compose launch, missing service override, or loopback value.

## Check

- `uv run pytest tests/test_config.py -q` → 5 passed, 1 existing dependency warning.
- `git status --short` was clean before this evidence record; no product files changed for T09.
