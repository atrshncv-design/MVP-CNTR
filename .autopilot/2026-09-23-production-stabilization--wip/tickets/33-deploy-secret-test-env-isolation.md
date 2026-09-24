# 33 — D10: изоляция synthetic deploy check-env теста от CI-secret defaults

**Требование:** D10, C4 baseline. **После:** T32. **Зона:** только `technozrelost-backend/tests/test_infra_contracts.py`.

RED: CI задаёт `POSTGRES_PASSWORD=change_me`; positive-case `test_deploy_generates_256_bit_auth_secrets_without_logging_them` копирует весь env и наследует это значение, которое правильно отвергает `deploy.sh` production guard. Тест создаёт собственный синтетический `production.env` с валидными тестовыми значениями. Воспроизвести focused тест с теми же **непродуктовыми** env-ключами, затем минимально удалить из передаваемого subprocess-env конфликтующие ключи fixture, чтобы тест проверял именно файл. Не менять `deploy.sh`, guard/secret policy, CI env, реальные `.env` или продуктивные значения; не печатать созданные секреты.

Приёмка: positive-case GREEN с/без inherited CI defaults; negative weak-secret tests по-прежнему RED для слабых значений; focused suite, Ruff/mypy; полный CI после T32–T34. Исполнитель не меняет `.autopilot/**`, не коммитит/push'ит.
