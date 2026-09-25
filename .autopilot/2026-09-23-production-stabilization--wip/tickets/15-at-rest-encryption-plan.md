# 15 — DB-04: evidence-bound at-rest encryption plan

**Требования:** R23
**Blocked by:** 13
**Зона:** `technozrelost-backend/infra/at-rest-encryption-change-plan.md`
**Волна:** 4
**Status:** done

## Что должно заработать

Сохранить честную, проверяемую границу DB-04: по доступным compose/config-файлам описать состояние шифрования PostgreSQL volume, MinIO объектов, локальных snapshot/WAL и offsite-копий; где runtime host/KMS состояние недоступно, оставить `UNKNOWN`, не выдавая его за отсутствие или наличие шифрования. Подготовить локальный future-only change plan с альтернативами, key-rotation, совместимостью, rollback и stop conditions. Никаких production/config/secret изменений.

## Из брифа, дословно

> «Волна 2 — P1» (SEC-01, AI-01, DB-04, DB-05, CODE-01, CODE-02; для каждого — тест, доказывающий устранение)

## Разделы спецификации

«Решения по реализации», «Правила миграций и изменений», «Запреты production и стоп-триггеры», «C1 — детали».

## Критерии приёмки

- [ ] Новая заметка различает доказанное из tracked config и неизвестное состояние дисков, host snapshots, MinIO KMS/SSE и runtime keys.
- [ ] Варианты шифрования и ротации описаны с prerequisites, совместимостью restore, rollback и конкретными stop conditions; не выбраны за владельца.
- [ ] Нигде не сообщается, что DB-04 исправлен: итог честно `READY FOR APPROVAL` / `UNKNOWN` до подтверждения владельца и инфраструктуры.
- [ ] Файлы вне указанной зоны, production, `.env`, secrets, volumes и running services не читаются/не меняются; миграции, deploy и restart запрещены.
- [ ] Независимая проверка документа подтверждает ссылки на tracked paths, отсутствие секретных значений и `git diff --check`.

## Запреты и границы

- Только один новый markdown-файл в указанной зоне; существующий аудит immutable.
- Не включать конкретные ключи/значения и не предлагать проверять содержимое диска.
- Не добавлять/изменять MinIO SSE, KMS, compose, env examples, миграции, тесты или app-код: поставщик/KMS/ключевой lifecycle не утверждены.
- Не выполнять команды, меняющие production, локальные сервисы или данные.
