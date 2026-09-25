# T34 — portable OpenSSL SAN argv

- Код `5706518`: `infra/tls_deploy_gate.py` и `tests/test_tls_deploy_gate.py`; отправлен в `origin/autopilot/production-stabilization`. Никаких production-файлов, сертификатов или ключей не читали и не меняли.
- Исполнитель: новая OpenCode-сессия `opencode/space-bunny-free` с вариантом `max`. Он сообщил о RED нового regression-теста до исправления и GREEN после; первый полный pytest был прерван внутренним лимитом команды 5 минут, повторный завершился. Финальный контракт получен отдельным запросом без новых правок.
- Независимый focused TLS suite: 40 passed, 1 dependency warning; до нового теста было 39. Отрицательные fail-closed сценарии остаются в этом файле и прошли.
- Независимый полный backend regression с временным test Redis и синтетическим CI-default: `uv run --python 3.11 pytest -q infra/alerter/test_alerter.py tests --tb=line` — 752 passed, 2 dependency warnings, 457.61 s. Отдельная test DB; production не затронут.
- Ruff по `app tests infra/alerter scripts/udgu_ingest` — exit 0. Mypy `app` — exit 0, 62 files. `git diff --check` — exit 0.
- Linux OpenSSL 3.0.20 проверен в эфемерном локальном контейнере `--network none` на синтетическом сертификате: объединённый аргумент `"-ext subjectAltName"` → exit 0, 0 байт stdout; раздельные `-ext subjectAltName` → exit 0, SAN присутствует. Контейнер удалён по завершении; образ не содержал pytest, поэтому полноценный Linux test suite остаётся задачей GitHub CI.
- Manifest+Spec review: PASS, blocking нет. Craft review: clean, blocking нет. Публичный TLS gate сохранил fail-closed.
- Граница доказательства: native Linux OpenSSL behavior подтверждён, но GitHub Actions backend job после `5706518` ещё не подтверждён GREEN.
