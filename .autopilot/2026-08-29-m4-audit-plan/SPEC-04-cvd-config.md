# SPEC-04: Единый TTL CVD и SOPS-документация (M-02, I-03)

## Контекст
`M-02` `app/services/file_storage.py:44` `CVD_MAX_AGE_SECONDS = settings.cvd_max_age_seconds` (604800) и `infra/alerter/alerter.py:27` `CVD_MAX_AGE_SECONDS: float = 7*24*3600` + `AlerterConfig.cvd_max_age_seconds` via `env CVD_MAX_AGE_SECONDS` — дублирование через env, но `technozrelost-backend/infra/.env.production.example:1` строка `# CVD_MAX_AGE_SECONDS=604800` закомментирована → prod пойдёт дефолт в обоих местах, drift при правке одного. `I-03` `.sops.yaml:7` `age1ql3z7…placeholder` — шифрование `secrets.enc.env` не рабочее для прод, `docs/SOPS.md` уже есть но ключ placeholder — для пилота `0600 .env` ок, для B2G нужен реальный `age-keygen`. Затронуты `app/core/config.py`, `app/services/file_storage.py`, `infra/alerter/alerter.py`, `infra/.env.production.example`, `.sops.yaml`, `docs/SOPS.md`.

Текущее неправильно: два исходника магических 604800, env не активен; SOPS ключ не заменит `0600` без ручной перешифровки.

## Цель
Один env `CVD_MAX_AGE_SECONDS=604800` — источник для `settings.cvd_max_age_seconds` и `alerter` `cvd_max_age_seconds`; `SOPS` задокументирован как отложенный до B2G.

## Не входит
Замена `pymupdf`, смена `clamav` образа (SPEC-01), `nginx` (SPEC-03).

## Функциональные требования
- `FR-01` `infra/.env.production.example` раскомментить `CVD_MAX_AGE_SECONDS=604800` с комментом `L-03 / INF-18: синхронизировано с app/core/config.py cvd_max_age_seconds`.
- `FR-02` `app/core/config.py` уже `cvd_max_age_seconds: int = 7*24*3600` читает `CVD_MAX_AGE_SECONDS` env (pydantic `BaseSettings` env). Убедиться что `env` имя `CVD_MAX_AGE_SECONDS` (дефолт 604800) — не `cvd_max_age_seconds` lower.
- `FR-03` `infra/alerter/alerter.py:27` `CVD_MAX_AGE_SECONDS = 7*24*3600` остаётся дефолт, `AlerterConfig.from_env()` уже читает `CVD_MAX_AGE_SECONDS` env → `cvd_max_age_seconds`. Не импортировать `app` в alerter.
- `FR-04` `docs/SOPS.md` раздел «Прод B2G» — явно: pilot `0600 .env` допустим, prod `age-keygen -o age.key && sops --encrypt --age age1… secrets.enc.env` — placeholder остаётся в репо, реальный ключ в 1Password — отложено (I-03 P3).

## Нефункциональные
- Совместимость: env имя `CVD_MAX_AGE_SECONDS` одинаково в `config.py` и `alerter.py`.
- Безопасность: `secrets.enc.env` не содержит plaintext, `age1placeholder` не роняет `sops`.

## Техническое решение
- `infra/.env.production.example`: раскомментить строку `CVD_MAX_AGE_SECONDS=604800` (убрать `# `) и добавить коммент `L-03`.
- `app/core/config.py`: проверить `cvd_max_age_seconds: int = Field(default=604800, alias="CVD_MAX_AGE_SECONDS")` или `model_config env_prefix` — если уже `cvd_max_age_seconds` без alias, то `env` будет `CVD_MAX_AGE_SECONDS` автоматически (pydantic case-insensitive). Оставить как есть, только доку.
- `infra/alerter/alerter.py`: уже `CVD_MAX_AGE_SECONDS: float = 7*24*3600` и `from_env` читает `CVD_MAX_AGE_SECONDS` — не менять, только коммент `L-03 синхронизировано`.
- `docs/SOPS.md`: добавить секцию «Отложено до B2G: placeholder ключ заменить `age-keygen`».

## Сценарии
- **Given** `CVD_MAX_AGE_SECONDS=123` в `.env.production`, **When** `deploy.sh` → `settings.cvd_max_age_seconds==123` и `alerterConfig.cvd_max_age_seconds==123` **Then** оба 123.
- **Given** env пустой, **When** старт **Then** оба 604800.

## Безопасность
- `CVD` возраст — не секрет, но env не логировать.

## Тестирование
- `tests/test_cvd_const_single_source` — `grep` один источник `CVD_MAX_AGE_SECONDS` в `config.py` и `alerter.py` и `.env.example`.

## Критерии приёмки
- [ ] `.env.production.example` `CVD_MAX_AGE_SECONDS=604800` не закомментирован.
- [ ] `grep CVD_MAX_AGE_SECONDS` в `config.py` и `alerter.py` и `.env.example` — все 604800.
- [ ] `docs/SOPS.md` секция I-03.

## Definition of Done
FR, тесты, доки, `ruff/mypy` pass, нет TODO.
