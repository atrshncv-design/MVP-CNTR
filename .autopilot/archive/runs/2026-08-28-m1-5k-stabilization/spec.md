# Спецификация: M1 — Стабилизация 5К (24 P1 + интервью-контуры)

## Задача

Закрыть все P1 `docs/BACKLOG.md` (19 P1 + 5 интервью-дополнений) к заморозке 01.11 для пика 5К (714 RPS 500 conc LLM, пагинация 20, 2 хоста 84 ГБ) и 10К готовности (1428 RPS 1000 conc, 3 хоста 166 ГБ) с учётом интервью 280826 (Туно tuno vs Каба kaba `0028` contour, админка max `19-`, мэтчинг LLM 5 полей `25-` топ-5 через центр `14-` V2, пагинация 20 `27-`, хотфиксы 02:00 `28-`, SOPS `23-`). Каждый тикет — отдельный `/autopilot` сабагент `T2` wave.

## Решение

К концу M1 платформа проходит `P1` `Plan.md:140` `G1→G2`:
- LLM-контур безопасен (`N-05`), throttle/брутфорс закрыты (`N-07/08`, `P-04`), bcrypt/MinIO/SSE не блокируют loop (`Q-01`, `P-02`, `N-03`), scheduler один (`P-03`), фронт `401`/`FE-04` зелёный, индексы/пагинации 5К держат (`P-05..08` + `27-`), лимиты/логи/nginx/DR (`INF-08..13`), rate limit (`N-18`), интервью-контуры (`R22-24`).

## Пользовательские истории

| # | Метка | История | Приёмка |
|---|-------|---------|---------|
| 1 | N-05 | Как CTO, LLM-гейтвей не пускает ПДн в облако (`gateway_enabled=false` allowlist) | тест `название с ФИО не покидает контур` зелёный `Plan.md:G2` |
| 2 | N-07 | Как платформа, брутфорс не растит память `_attempts` | LRU/TTL, `auth_throttle.py:21` без роста |
| 3 | N-08 | Как платформа, `/auth/register` троттлится как `/login` | `429` при 10/60с |
| 4 | Q-01 | Как API, смена пароля не блокирует loop | `users.py:68` `to_thread` `await` |
| 5 | P-02 | Как API, MinIO не блокирует `news.py:487` | `to_thread` `put`/`scan` |
| 6 | P-03 | Как оператор, шедулер один при `replicas=2` | `pg_try_advisory_lock` `main.py:56` или 1 контейнер `scheduler` |
| 7 | P-04 | Как платформа, throttle общий на 2 реплики | `Redis INCR EXPIRE 60` `auth_throttle.py:37` `compose:112` |
| 8 | N-03 | Как платформа, SSE не держит `Session` | `realtime.py:46` snapshot + Redis pubsub |
| 9 | FE-03 | Как пользователь, `RefreshAccessTokenError` → `/login` | `middleware.ts:27` + `api-client.ts:36` 401→signOut |
|10 | FE-04 | Как CI, `npm audit` без high | `overrides` `js-yaml` `nanoid` `lockfile` + `audit` в `ci.yml` |
|11 | P-05 | Как реестр, `ILIKE`/`ogrn`/`JSONB` с индексами | миграция `0028` `trgm GIN` `GIN on nioktr_types` `Hash ogrn` `0027` образец |
|12 | P-06 | Как реестр, `count` не O(N) на организацию | `LATERAL` / materialized `nioktr.py:76` |
|13 | P-07 | Как реестр, карточка с `limit 20` | `nioktr.py:114` `LIMIT 20` `27-` |
|14 | P-08 | Как реестры, списки с `keyset` пагинацией | `projects.py:212` + `executors.py:119` `after_id` |
|15 | INF-08 | Как хост, контейнеры с `limits` | `compose.prod.yml` `deploy.resources.limits` `backend/clamav` |
|16 | INF-09 | Как хост, логи с `max-size` | `logging max-size 10m max-file 3` `compose` |
|17 | INF-12 | Как edge, nginx `resolver 127.0.0.11` + `limit_req` + `gzip` + `cache _next/static` | `nginx.prod.conf:41` |
|18 | INF-13 | Как владелец, `SPOF` один хост документирован + `DR-runbook` + окно техработ 02:00-04:00 GMT+4 + hotfix | `docs/RUNBOOK-DR.md` `28-техработы-с-хотфиксом.md` `restore.sh` `stop→restore→start` |
|19 | N-18 | Как платформа, публичные реестры с `rate limit` | `limit_req` `nioktr` + Redis `N-18` |
|20 | R22 | Туно `tuno` vs Каба `kaba` `0028` contour два ivfflat `WHERE`, `POST /chat/tuno\|kaba` | `13-` `0028` `rag.py:26` |
|21 | R23 | Админка max: `KPI` `19-` `12` + `manager` урезан `Бюджет` `cntr_manager:72` | `cntr_admin/page.tsx` `cntr_manager/page.tsx` |
|22 | R24 | Мэтчинг LLM 5 полей `title+annotation/sector/ugt/region/competencies` топ-5 через центр `14- V2` | `POST /match` `queue llm-eval` `25-` |
|23 | R25 | Доки мгновенные `22-` `docs/adr` + `SOPS` `23-` `secrets.enc.env` | `docs/` + `SOPS age` |
|24 | R01-02 | Дедуп/логика: нет дублей со старыми `M0` `N-01` `FE-01/02` `INF-01..07` | `de-dupe-report.md` `G2` |

Каждая история — `Как <кто>, я <что>, чтобы <зачем>` + приёмка.

## Решения по реализации

- **LLM (N-05):** `Settings.llm_gateway_enabled` `config.py:57` `false` + allowlist `title+annotation/sector/ugt` `Q18` `contour` `13-` + `nh3` `html_sanitizer.py`.
- **Throttle (N-07/08, P-04):** `Redis fixed window` `INCR EXPIRE 60` `compose:112` `auth_throttle.py:18` LRU 10k `TTL 60`.
- **Loop (Q-01, P-02, N-03):** `asyncio.to_thread` `users.py:68` `news.py:487` `realtime.py:46` `snapshot` + `Redis pubsub` `realtime.py:31` dict→pubsub.
- **Scheduler (P-03):** `pg_try_advisory_lock(42)` `main.py:56` или отдельный `scheduler:1` `compose:229` как `backup-timer`.
- **Frontend (FE-03/04):** `middleware.ts:27` `RefreshAccessTokenError→/login` `api-client.ts:36` `overrides` `package.json` `audit`.
- **Индексы (P-05):** `0028` `CREATE EXTENSION pg_trgm` `GIN`, `USING GIN (nioktr_types)`, `Hash (ogrn)`, `B-Tree is_ai_area` `0027`.
- **Пагинация (P-06..08):** `P-07` `LIMIT 20` `27-` `P-06` `LATERAL` `P-08` `keyset` `after_id` `projects.py:212`.
- **Infra (INF-08..13):** `limits` `1cpu/2G` `backend` `2cpu/4G` `clamav`, `logging max-size`, `nginx resolver 127.0.0.11` `proxy_pass http://$backend` `limit_req zone=auth burst=10` `gzip` `cache _next/static immutable`, `DR-runbook` `stop→чистая БД→restore→start`.
- **R22:** `0028` `ADD COLUMN contour CHECK(tuno,kaba)` `ivfflat WHERE contour`, `RagSearchIn.contour` `schemas.py:311` `POST /chat/tuno|kaba` `rag.py:26`.
- **R23:** `POST /match` `retriever pg_trgm 20` → `LLM rerank 5` `queue llm-eval` `25-` `MatchRequest` через центр.
- **Дедуп (R24):** `G2` `de-dupe-report.md` сверка `BACKLOG.md` `P1` vs `M0` `spec.md` `История 1-19` vs `interview` `14-` `5 полей` — нет дублей.

## Границы и швы

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `backend/throttle` | `auth_throttle.py` `Redis` | `429` | `INCR` |
| `backend/loop` | `to_thread` `file_storage` | `clean` | `scan` |
| `backend/RAG` | `contour` `tuno/kaba` | `POST /chat/tuno\|kaba` | `vector 1536` |
| `frontend/auth` | `middleware` `api-client` | `/login` | `JWT` |
| `infra` | `limits/logs/nginx/DR` | `deploy.sh` `health-gate` | `toml` |
| `interview` | `пагинация 20` `мэтчинг` `админка` | `POST /match` `KPI` | `sector` |

Швы: `pytest 334` `node --test 39` `ruff/mypy` `security_check.py` `loadtest.py` `714 RPS 5К` `p95 500мс` `G2` `rehearse_pitr` `DR` `1ч`.

## Вне рамок

- P2 `BACKLOG.md` 27 пунктов, `mэтчинг` `score`, `локальная LLM 70B` `09-смета` `167к`.
- Пентест внешний — после `M1` `Q13`, `SLO` `p95 500мс` `08-`.

## Открытые места

- `LLM_API_KEY` `opencode zen` `free` — ставит CTO.
- `closed` — вне платформы `Q22`.
- `matching` `score` — после `v1`.

## Покрытие манифеста

| Требование | Раздел |
|---|---|
| R01 | История 1-23 + дедуп 24 |
| R02 | История 24 `de-dupe-report.md` |
| R03-21 | Истории 1-19 `P1` |
| R22-24 | Истории 20-23 `интервью` |
