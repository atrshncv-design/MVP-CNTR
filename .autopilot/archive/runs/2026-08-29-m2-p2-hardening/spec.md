# Спецификация: M2 — P2 харденинг 27 пунктов (август, не ждать 01.12)

## Задача

Закрыть все P2 `docs/BACKLOG.md:70` 27 пунктов сейчас, август: `N-09..N-17`, `FE-05/06`, `INF-10/11/14..20`, `P-09..11`, `P-13..16` + `PROC-01/02` в `27-`? Сейчас 27: `N-09,N-10,N-11,N-12,N-13,N-14,N-15,N-16,N-17,FE-05,FE-06,INF-10,INF-11,INF-14,INF-15,INF-16,INF-17,INF-18,INF-19,INF-20,P-09,P-10,P-11,P-13,P-14,P-15,P-16` (+ `P-17 PROC-01/02` deferred). Каждый — отдельный критерий, не блокер `G2` но гигиена `M0` `craft` `high`.

## Решение

К концу M2:
- Токены `N-09` revoke family, `N-10` `metrics/ai` без `user_id`, `N-11` OOXML структура, `N-12` `News.content` limit
- Комменты/файлы `N-13` `XFF last hop`, `N-14` `filename*`, `N-15` `file_ref` валидация, `N-16` per-user questionnaire
- Зависимости `N-17` `pyproject` pins + `pymupdf` AGPL
- CSP `FE-05` nonce, `FE-06` 403 + CSP `form-action`
- Infra `INF-10` `pg_stat_replication` metrics, `INF-11` `ACME webroot` убираем, `INF-14` pinned tags, `INF-15` сети `edge/app-db/monitoring`, `INF-16` `requirepass`, `INF-17` `scram-sha-256`, `INF-18` `CVD age`, `INF-19` `versioning`, `INF-20` `localhost stub` расширяем
- Perf `P-09` ETag, `P-10` `X-Request-ID`, `P-11` `exception_handler`, `P-13` delete после commit, `P-14` `Date`, `P-15` batch, `P-16` `selectin` точечно

## Пользовательские истории

| # | Метка | История | Приёмка |
|---|-------|---------|---------|
| 1 | N-09 | reuse отозванного refresh ревокит всю семью | тест `reuse → все revoked` |
| 2 | N-10 | /chat/metrics без user_id | `requests_by_user` без `user_id` |
| 3 | N-11 | OOXML проверяет [Content_Types].xml | ZIP без `Content_Types` → 422 |
| 4 | N-12 | News.content ≤20000 | `max_length 20000` `schemas.py:768` |
| 5 | N-13 | Коммент XFF = last hop | `auth.py:78` коммент `last hop` |
| 6 | N-14 | filename кириллица RFC5987 | `filename*=UTF-8` |
| 7 | N-15 | file_ref валидация MinIO | 404 если нет объекта |
| 8 | N-16 | questionnaire per-user | `user_id` в `save_questionnaire` |
| 9 | N-17 | pyproject pins + pymupdf замена | `uv.lock` pinned, `pymupdf` оценка |
|10 | FE-05 | CSP nonce без unsafe-inline | `next.config.ts:13` `nonce` |
|11 | FE-06 | Deny 403 + CSP form-action | `middleware:39` `403` `next.config:28` |
|12 | INF-10 | Lag реплики в /metrics + алерт | `pg_stat_replication` `metrics.py` |
|13 | INF-11 | ACME stub убрать | `nginx.prod.conf:27` удалить `location /.well-known` |
|14 | INF-14 | minio/clamav pinned | `image: minio:RELEASE...` `clamav:1.0` digest |
|15 | INF-15 | сети edge/app-db/monitoring | `compose` `networks: tz-edge` |
|16 | INF-16 | Redis requirepass | `redis.conf requirepass` env |
|17 | INF-17 | pg_hba scram-sha-256 | `pg_hba.conf md5→scram` |
|18 | INF-18 | CVD age метрика + алерт | `file_storage 131` `age` `metrics` |
|19 | INF-19 | MinIO versioning | `bucket versioning on` |
|20 | INF-20 | localhost stub расширяем | `deploy.sh:30` `https://localhost` warn |
|21 | P-09 | ETag кэш справочников | `ETag` `medals` `66` |
|22 | P-10 | X-Request-ID | `middleware X-Request-ID` `logs` |
|23 | P-11 | exception_handler | `main.py:106` `handler` `500` `request-id` |
|24 | P-13 | delete_news после commit | `news.py:484` `after commit` |
|25 | P-14 | created_date Date | `models.py:701` `Date` `migr` |
|26 | P-15 | scheduler batch | `notifications.py:97` `batch 500` |
|27 | P-16 | selectin точечно | `models.py:811` `selectin` убрать `options` |

## Решения по реализации

- **Токены/файлы:** `auth.py:96` `revoke family` `ON CONFLICT`, `chat.py:42` `aggregation`, `file_storage.py:23` `zipfile [Content_Types]`, `schemas.py:768` `max_length`, `files.py:153` `filename*`, `projects.py:631` `exists storage`, `projects.py:531` `per-user`.
- **Зависимости/CSP:** `pyproject.toml` `pinned + pymupdf→pypdf`, `next.config.ts:13` `nonce` `middleware:39` `403`.
- **Infra:** `metrics.py` `pg_stat_replication`, `nginx.prod.conf:27` удалить `well-known`, `compose` `image:tag@digest` `networks` `redis requirepass` `pg_hba scram` `CVD age` `versioning` `warn_placeholder` `localhost`.
- **Perf:** `ETag` `P-09`, `X-Request-ID` `P-10`, `exception_handler` `P-11`, `P-13` `after commit`, `P-14` `Date`, `P-15` `batch`, `P-16` `options`.

## Границы и швы

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `backend/tokens` | revoke family | `POST /logout reuse` | `refresh` |
| `backend/files` | OOXML/file_ref | `422` `404` | `PK` |
| `frontend/csp` | nonce | `CSP` | `hash` |
| `infra` | lag/acme/network | `metrics` `nginx` | `toml` |

Швы: `pytest` `ruff/mypy` `npm audit`.

## Вне рамок

- P2 `P-17` `PROC-01/02` — deferred `M2` `15.11` после `M1`.

## Открытые места

- `pymupdf` AGPL замена — оценка, не замена сейчас.

## Покрытие манифеста

| Требование | Раздел |
|---|---|
| R02-R10 N-09..N-17 | Истории 1-9 |
| R11-12 FE-05/06 | 10-11 |
| R13-21 INF-10..20 | 12-20 |
| R22-28 P-09..16 | 21-27 |
