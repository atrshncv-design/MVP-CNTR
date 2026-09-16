# TICKET-01: Digest clamav официал (H-01)

- **Связанная спецификация:** SPEC-01
- **Связанные проблемы аудита:** H-01 (`infra/docker-compose.prod.yml:134` `mkodockx/docker-clamav:1.4.3-r0-alpine@sha256:b443…` placeholder)
- **Приоритет:** P0
- **Критичность:** High
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-03,05,06

## Проблема
`docker-compose.prod.yml:134` `image: mkodockx/docker-clamav:1.4.3-r0-alpine@sha256:b443cd4fb3…` — placeholder, тег отсутствует в Hub (85 тегов, макс 1.1.2, `docker manifest inspect mkodockx/docker-clamav:1.4.3-r0-alpine` → `no such manifest`). Коммент прямо пишет `TODO placeholder`. `minio` уже pinned `a1ea…` но пара неполная → supply-chain не детерминирован, `docker compose pull` мутабелен.

## Требуемый результат
`infra/docker-compose.prod.yml` `clamav: clamav/clamav:1.4.3@sha256:75fb5fd95fcbe1d7e6d240c369c1572b686ee2c95949d1042b5148de8eddebb4` (ofiціал, oci index, amd64, verified 2026-08-29). `minio` остаётся. `grep -c @sha256` ≥2, `docker pull` re-pull месяц спустя — тот же `RepoDigest`.

## Объём работ
- `docker pull clamav/clamav:1.4.3 && docker inspect --format '{{index .RepoDigests 0}}' clamav/clamav:1.4.3` → верифицировать `sha256:75fb…` (если Hub недоступен — взять из `docs/adr/0016` но повторить `inspect` перед коммитом).
- Заменить строку `image: mkodockx/docker-clamav:1.4.3-r0-alpine@sha256:b443…` на `clamav/clamav:1.4.3@sha256:75fb5fd95fcbe1d7e6d240c369c1572b686ee2c95949d1042b5148de8eddebb4` + обновить коммент над ней: `# M-04/TICKET-01: oficiální digest, mkodockx 1.4.3 absent → clamav/clamav oficial`.
- `docker compose -f technozrelost-backend/infra/docker-compose.prod.yml config | grep image` проверить.

## Не входит
`minio` digest (уже), `uv.lock` (TICKET-02), `nginx` (TICKET-05).

## Затрагиваемые компоненты
- Файл: `technozrelost-backend/infra/docker-compose.prod.yml:101,134`
- Образы: `clamav/clamav:1.4.3`

## План реализации
1. `read infra/docker-compose.prod.yml:130..140`.
2. `docker pull clamav/clamav:1.4.3` + `inspect` → confirm `75fb…`.
3. Edit `image:` line + коммент.
4. `docker compose -f infra/docker-compose.prod.yml config` no error, `grep -c @sha256` 2.
5. `ruff/mypy` no touch.

## Пограничные случаи
- `clamav/clamav:1.4.3` amd64 only — на ARM хосте нужен `buildx` — доку в ADR-0016.
- `# CVD_MAX_AGE` не трогать.

## Тесты
- `tests/test_infra_contracts.py` добавить `test_digest_pinned` — `@sha256` count 2 и `clamav/clamav` substring.

## Критерии приёмки
- [ ] `grep @sha256` 2, `clamav/clamav:1.4.3@sha256:75fb…`.
- [ ] `docker inspect` RepoDigest matches.
- [ ] `docker compose config` OK.

## Команды проверки
- `grep -c "@sha256" technozrelost-backend/infra/docker-compose.prod.yml`
- `docker pull clamav/clamav:1.4.3 && docker inspect --format '{{index .RepoDigests 0}}' clamav/clamav:1.4.3`
- `.venv/bin/ruff check app && .venv/bin/mypy app`

## Риски
- `clamav/clamav` 1.4.3 oci index — старый, без `alpine` tag — проверить `HEALTHCHECK` ClamAV PING.
