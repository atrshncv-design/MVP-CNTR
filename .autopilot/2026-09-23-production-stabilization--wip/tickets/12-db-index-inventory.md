# 12 — DB-03: канонический список и автоматическая проверка индексов

**Требование:** R24, DB-03. **После:** T11 и baseline гейтов. **Волна:** 3. **Зона:** `technozrelost-backend/docs/database-indexes.md`, `technozrelost-backend/tests/test_db_index_inventory.py`.

## Источник и ограничение

Finding DB-03 подтверждает, что часть индексов управляется Alembic и не видна в `Base.metadata`, в частности частичные pgvector ivfflat. Требование брифа: «DB-03 закрывай документацией и автоматической проверкой канонического списка индексов, если код уже соответствует требованиям».

Аудит-базлайн `docs/audit/2026-09-21-production/` immutable: не редактировать и не использовать файл `docs/audit/2026-09-21-production/04-database/db-model.md` как целевой документ. Создай поддерживаемый продуктовый инвентарь в зоне этого тикета. Не меняй ORM-модели, Alembic-файлы, схему БД, зависимости, CI, конфигурацию или production.

## Изменение

- Сначала создай статический regression test, который падает до появления/актуализации канонического инвентаря.
- Инвентаризируй текущие ORM-индексы через `Base.metadata` и индексы, управляемые миграциями (включая 0027, 0028, 0029, 0031, 0036). Используй проверенные источники в коде и перечисли каждый индекс с таблицей, методом/условием там, где оно задано, и ссылкой на ORM declaration либо migration file. Не выводи production-состояние из локального каталога.
- Явно объясни, почему migration-managed ivfflat и прочие миграционные индексы могут отсутствовать в ORM metadata.
- Статический тест без PostgreSQL должен сверять документ с объявленными источниками и обязательно ловить исчезновение двух частичных `rag_documents_embedding_{tuno,kaba}_ivfflat` из миграций/инвентаря. Он не должен исполнять DDL или подключаться к БД.
- Не дублируй документацию аудита и не превращай инвентарь в обещание production parity.

## Приёмка

- Созданы только `technozrelost-backend/docs/database-indexes.md` и `technozrelost-backend/tests/test_db_index_inventory.py`.
- Статический regression сначала воспроизводимо красный без документа, затем зелёный; тест покрывает оба ivfflat индекса и миграционно-управляемый раздел.
- `uv run pytest tests/test_db_index_inventory.py -q`, Ruff и mypy проходят; никаких сетевых/production-действий и DB-мутаций.
- Не менять другие тесты, приложения, ORM, миграции, lock/config, `.autopilot`/Status/dashboard. Не коммитить и не пушить.

## Проверка

Из `technozrelost-backend/`: `uv run pytest tests/test_db_index_inventory.py -q`; `uv run ruff check tests/test_db_index_inventory.py`; `uv run mypy app`.

## Повторный запуск после остановки по разрешениям

Предыдущая свежая сессия успела создать незавершённый `tests/test_db_index_inventory.py`, но остановилась, когда запросила разрешение на запись в эту папку. Владелец теперь явно разрешил OpenCode запись ровно в два scoped target path из этого тикета. Сначала проверь текущий partial test; закончи или замени его в пределах зоны, затем создай документацию и добейся зелёных команд выше. Если OpenCode всё ещё блокирует запись, не обходи разрешения и верни BLOCKED. В любом случае в конце верни полный контракт Autopilot (до 25 строк).

Последняя попытка после Graphify permission interruption: не вызывай Graphify и не читай/записывай `.graphify`. Для исходников используй только узкие project-relative `rg`/`sed`/`uv run python` команды из корня backend; записывать разрешено только два target path из заголовка. Не запрашивай расширение разрешений за их пределы.

Recovery: тот же Git worktree (ветка/HEAD сохранены) перемещён на ASCII-only `/private/tmp/production-stabilization`, чтобы избежать повреждения Unicode в OpenCode абсолютных путях. Все write/edit tool calls делай project-relative: `technozrelost-backend/tests/test_db_index_inventory.py` и `technozrelost-backend/docs/database-indexes.md`; не используй абсолютные пути и не меняй файлы вне этой пары. Владелец прямо указал продолжить работу после предыдущих остановок; завершить T12 и вернуть контракт, не коммитить.

При нехватке фактической информации не угадывай — верни `BLOCKED` с точными путями и вопросом. Верни контракт Autopilot (не более 25 строк).
