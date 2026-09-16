# TICKET-08: Digest pinning (M-04)

- **Спека:** SPEC-04
- **Проблемы:** M-04 (tag без digest)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** S
- **Зависимости:** TICKET-05 (чистый lock)
- **Можно параллельно с:** TICKET-06,07,09,11

## Проблема
`docker-compose.prod.yml:101` `minio:RELEASE...` и `clamav:1.4.3` без `@sha256:` → `docker pull` мутабелен.

## Требуемый результат
`image: minio/minio:RELEASE.2025-04-22T22-12-26Z@sha256:<64hex>` и `mkodockx/docker-clamav:1.4.3-r0-alpine@sha256:<64hex>`.

## Объём работ
- `docker pull minio/minio:RELEASE.2025-04-22T22-12-26Z && docker inspect --format '{{index .RepoDigests 0}}'`.
- Вписать digest в `infra/docker-compose.prod.yml:101` и `clamav:131`.
- `docker compose --env-file infra/.env.production -f infra/docker-compose.prod.yml config | grep image`.

## Не входит
`uv.lock` (TICKET-05).

## Компоненты
- Файл: `infra/docker-compose.prod.yml`

## План
1. `docker pull` обе.
2. `inspect` digest.
3. Edit `compose` строки.
4. `docker compose config` валидация.

## Пограничные случаи
- Digest 64 hex — проверить `sha256:` prefix.
- `IMAGE_TAG` override — не трогать `backend` image.

## Тесты
- `test_production_compose_wires_replication` уже PASS → не сломать.
- `grep -c "@sha256" infra/docker-compose.prod.yml` ==2.

## Критерии приёмки
- [ ] Две строки с `@sha256:`.
- [ ] `config` valid.

## Команды проверки
- `docker compose -f infra/docker-compose.prod.yml config | grep -E "image:.*@sha256"`

## Риски
- Digest изменится при re-push — нужно периодически `pull` и обновлять.
