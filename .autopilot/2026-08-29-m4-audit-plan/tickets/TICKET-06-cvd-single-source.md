# TICKET-06: CVD единый источник (M-02)

- **Спека:** SPEC-04
- **Проблемы:** M-02 (`file_storage.py:44` + `alerter.py:27` дубль `7*24*3600`, env закомментирован)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-05,08

## Проблема
`CVD_MAX_AGE_SECONDS` дубль 604800 в `file_storage.py:44` (`settings.cvd_max_age_seconds`) и `alerter.py:27` + `infra/.env.production.example:1` `# CVD_MAX_AGE_SECONDS=604800` закомментирован → prod дефолт в обоих местах, drift при правке одного.

## Требуемый результат
`.env.production.example` `CVD_MAX_AGE_SECONDS=604800` не закомментирован, `config.py` `cvd_max_age_seconds: int = 604800` env, `alerter` `CVD_MAX_AGE_SECONDS` default 604800 via `env`.

## Объём работ
- `read infra/.env.production.example | grep CVD`.
- Раскомментить `CVD_MAX_AGE_SECONDS=604800` (убрать `# `) + коммент `L-03 / INF-18: синхронизировано с app/core/config.py`.
- `read app/core/config.py | grep cvd` — проверить `cvd_max_age_seconds: int = 7*24*3600` уже, env имя `CVD_MAX_AGE_SECONDS` — оставить.
- `read infra/alerter/alerter.py | grep CVD` — уже `CVD_MAX_AGE_SECONDS = 7*24*3600` и `from_env` — добавить коммент `L-03`.

## Не входит
`clamav` образ (TICKET-01), SOPS (TICKET-07).

## Компоненты
- Файлы: `infra/.env.production.example`, `app/core/config.py`, `infra/alerter/alerter.py`

## План
1. `read .env.production.example` → `# CVD_MAX_AGE_SECONDS`.
2. Edit: `CVD_MAX_AGE_SECONDS=604800` + коммент.
3. `read config.py` → verify.
4. `grep CVD_MAX_AGE_SECONDS` везде.

## Пограничные случаи
- env пустой → оба 604800.
- `CVD_MAX_AGE_SECONDS=123` → оба 123.

## Тесты
- `tests/test_cvd_const_single_source` — `grep` один источник.

## Критерии приёмки
- [ ] `.env.production.example` `CVD_MAX_AGE_SECONDS=604800` не закомментирован.
- [ ] `grep CVD_MAX_AGE_SECONDS` в 3 файлах — все 604800.

## Команды проверки
- `grep -n CVD_MAX_AGE_SECONDS technozrelost-backend/infra/.env.production.example`
- `grep -n CVD_MAX_AGE_SECONDS technozrelost-backend/app/core/config.py`
- `grep -n CVD_MAX_AGE_SECONDS technozrelost-backend/infra/alerter/alerter.py`

## Риски
- `pydantic` case-insensitive — env `cvd_max_age_seconds` lower тоже ок.
