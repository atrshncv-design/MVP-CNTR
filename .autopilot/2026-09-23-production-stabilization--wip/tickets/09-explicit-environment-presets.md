# 09 — CODE-04: явные dev/prod-пресеты конфигурации

**Требование:** R24 (часть CODE-04). **После:** T08 и regression-гейта. **Зона:** backend config/examples/tests; без production-конфигурации и секретов.

## Контекст и RED

`docs/audit/2026-09-21-production/09-final/findings.json` → `CODE-04`: единый `Settings` содержит локальные host/origin/MinIO/ClamAV defaults, при этом prod-guard защищает секреты. Текущий compose уже явно задаёт часть production-host ключей. Сначала составить read-only матрицу **имён** полей: dev default, явный prod compose/env-example, существующий guard и потребитель. Не читать/выводить значения реальных `.env` или secret stores. Finding закрывать только по подтверждённому пробелу, не дублировать уже работающие guards.

## Изменение

- Минимально обозначить и разделить dev-only defaults от production-required настроек: документация/example и/или узкий validation guard для действительно неявных prod-полей. Не вводить второй Settings-класс, новый конфиг-фреймворк или массовую смену значений без доказанного дефекта.
- Защитить production от непреднамеренного localhost/loopback endpoint там, где такой default действительно может пройти через deployment; сохранить законные `0.0.0.0` bind/внутренние Docker DNS и test/dev пути.
- Добавить узкие RED→GREEN config tests для подтверждённого пробела. Если фактическая матрица показывает, что compose и guards уже исключают проблему, не менять продуктовый код: вернуть evidence и предложить статус finding «не воспроизводится/документировано».

## Приёмка

Prod guard и dev/test baseline проходят, нет новых обязательных секретов и утечки значений. Ruff/mypy/focused tests проходят; полный suite — оркестратор на regression-гейте. Исполнитель сдаёт матрицу имён и diff/evidence, не меняет `.autopilot/**`, не коммитит/push'ит и не трогает production.
