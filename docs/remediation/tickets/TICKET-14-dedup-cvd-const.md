# TICKET-14: Дедуп CVD константы (L-03)

- **Спека:** SPEC-05
- **Проблемы:** L-03 (дублирование `CVD_MAX_AGE_SECONDS`)
- **Приоритет:** P2
- **Критичность:** Low
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-13

## Проблема
`file_storage.py:44` `CVD_MAX_AGE_SECONDS = 7*24*3600` и `alerter.py:384` `max_age_seconds = 7*24*3600` — magic duplicate.

## Требуемый результат
Единый источник: `app/core/config.py` `cvd_max_age_seconds: int = 604800` (или `settings` env), оба читают.

## Объём работ
- `app/core/config.py` добавить `cvd_max_age_seconds: int = 7*24*3600`.
- `app/services/file_storage.py:44` `CVD_MAX_AGE_SECONDS = settings.cvd_max_age_seconds`.
- `infra/alerter/alerter.py:384` заменить хардкод на `from app.core.config import settings`? Но alerter вне `app` — лучше `os.getenv("CVD_MAX_AGE_SECONDS", "604800")` + `config.py` env, или просто константа `CVD_MAX_AGE = 604800` в `alerter.py` и `file_storage.py` импортирует из `config` — но alerter не импортирует `app`. Решение: вынести в `infra/alerter/config.py` или просто оставить дубли но с комментом `// keep in sync with file_storage.py` — P2, не критично. Выбрать: добавить `settings.cvd_max_age_seconds` и в `alerter.py` читать `os.getenv("CVD_MAX_AGE_SECONDS", "604800")` + единый `env`.

## Не входит
Scheduler (TICKET-15).

## Компоненты
- Файлы: `app/core/config.py`, `app/services/file_storage.py`, `infra/alerter/alerter.py` (опц.)

## План
1. `read config.py` → добавить `cvd_max_age_seconds`.
2. `file_storage.py` → `settings.cvd_max_age_seconds`.
3. `alerter.py` → `Max age from env or 604800` коммент.

## Пограничные случаи
- `alerter` вне `app` — `import app` может сломать `pytest` — использовать env.

## Тесты
- `grep CVD_MAX_AGE` 2 файла, один источник.

## Критерии приёмки
- [ ] `config.py` `cvd_max_age_seconds`.
- [ ] `file_storage.py` uses `settings`.

## Команды проверки
- `grep -n "CVD" app/services/file_storage.py app/core/config.py infra/alerter/alerter.py`

## Риски
- Нет.
