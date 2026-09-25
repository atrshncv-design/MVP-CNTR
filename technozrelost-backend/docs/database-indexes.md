# Канонический инвентарь индексов БД

## Назначение и границы

Документ фиксирует индексы, объявленные в текущем коде backend, для статической
регрессии DB-03. Это инвентарь исходников, а не снимок production-схемы: он не
подключается к БД, не выполняет DDL и не обещает parity с уже развёрнутой базой.

Источники инвентаря:

- ORM: явные объекты `Index` из `Base.metadata`, объявленные в
  `app/db/models.py`;
- миграционный контур DB-03: `db/migrations/sql/0002_rag_documents.sql`,
  `db/migrations/sql/0027_performance_indexes.sql`,
  `db/migrations/sql/0028_indexes_pagination.sql`,
  `db/migrations/sql/0029_rag_contour.sql`,
  `db/migrations/sql/0031_perf_p14_created_date.sql` и
  `db/migrations/sql/0036_semantic_embeddings_reindex.sql`.

В таблицу входят все явные ORM-индексы и все именованные `CREATE INDEX` из
перечисленных миграций. Первичные ключи, уникальные ограничения и индексы других
исторических миграций не дублируются здесь: их источником остаются соответствующие
DDL-файлы. Повторное создание `ix_nioktr_cards_created_date` в `0031` и контурных
RAG-индексов в `0036` показано в соответствующих строках со всеми
путями-источниками.

## Канонический список

| Индекс | Таблица | Ключ / выражение | Метод | Условие | Источник |
|---|---|---|---|---|---|
| `rag_documents_content_hash_hidx` | `rag_documents` | `content_hash` | `hash` | — | migration: `db/migrations/sql/0002_rag_documents.sql` |
| `rag_documents_type_created_bidx` | `rag_documents` | `doc_type, created_at` | `btree` | — | migration: `db/migrations/sql/0002_rag_documents.sql` |
| `rag_documents_ugt_bidx` | `rag_documents` | `ugt_level` | `btree` | — | migration: `db/migrations/sql/0002_rag_documents.sql` |
| `rag_documents_embedding_ivfflat` | `rag_documents` | `embedding vector_cosine_ops`, `lists = 100` | `ivfflat` | — | migration: `db/migrations/sql/0002_rag_documents.sql` |
| `ix_projects_public_registry` | `projects` | `current_level DESC, updated_at DESC` | `btree` | `WHERE is_public` | ORM: `app/db/models.py`; migration: `db/migrations/sql/0027_performance_indexes.sql` |
| `ix_projects_category` | `projects` | `category` | `btree` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0027_performance_indexes.sql` |
| `ix_project_members_user_id` | `project_members` | `user_id` | `btree` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0027_performance_indexes.sql` |
| `ix_nioktr_cards_created_date` | `nioktr_cards` | `created_date DESC NULLS LAST, id DESC` | `btree` | — | ORM: `app/db/models.py`; migrations: `db/migrations/sql/0027_performance_indexes.sql`, `db/migrations/sql/0031_perf_p14_created_date.sql` |
| `ix_nioktr_cards_organization_id` | `nioktr_cards` | `organization_id` | `btree` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0027_performance_indexes.sql` |
| `ix_news_posts_status_published` | `news_posts` | `status, published_at DESC NULLS LAST, id DESC` | `btree` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0027_performance_indexes.sql` |
| `ix_organizations_name_trgm` | `organizations` | `name gin_trgm_ops` | `gin` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0028_indexes_pagination.sql` |
| `ix_organizations_ogrn_hash` | `organizations` | `ogrn` | `hash` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0028_indexes_pagination.sql` |
| `ix_nioktr_cards_name_trgm` | `nioktr_cards` | `name gin_trgm_ops` | `gin` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0028_indexes_pagination.sql` |
| `ix_nioktr_cards_customer_name_trgm` | `nioktr_cards` | `customer_name gin_trgm_ops` | `gin` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0028_indexes_pagination.sql` |
| `ix_nioktr_cards_nioktr_types` | `nioktr_cards` | `nioktr_types` | `gin` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0028_indexes_pagination.sql` |
| `ix_nioktr_cards_is_ai_area_btree` | `nioktr_cards` | `is_ai_area` | `btree` | — | ORM: `app/db/models.py`; migration: `db/migrations/sql/0028_indexes_pagination.sql` |
| `ix_user_achievements_user_id_hash` | `user_achievements` | `user_id` | `hash` | — | ORM: `app/db/models.py` |
| `ix_user_achievements_achievement_id_hash` | `user_achievements` | `achievement_id` | `hash` | — | ORM: `app/db/models.py` |
| `ix_user_achievements_project_id_hash` | `user_achievements` | `project_id` | `hash` | — | ORM: `app/db/models.py` |
| `ix_project_achievements_project_id_hash` | `project_achievements` | `project_id` | `hash` | — | ORM: `app/db/models.py` |
| `ix_project_achievements_achievement_id_hash` | `project_achievements` | `achievement_id` | `hash` | — | ORM: `app/db/models.py` |
| `rag_documents_embedding_tuno_ivfflat` | `rag_documents` | `embedding vector_cosine_ops`, `lists = 100` | `ivfflat` | `WHERE contour = 'tuno'` | migrations: `db/migrations/sql/0029_rag_contour.sql`, `db/migrations/sql/0036_semantic_embeddings_reindex.sql` |
| `rag_documents_embedding_kaba_ivfflat` | `rag_documents` | `embedding vector_cosine_ops`, `lists = 100` | `ivfflat` | `WHERE contour = 'kaba'` | migrations: `db/migrations/sql/0029_rag_contour.sql`, `db/migrations/sql/0036_semantic_embeddings_reindex.sql` |

## Почему миграционные индексы отсутствуют в `Base.metadata`

`Base.metadata` отражает только объекты `Index`, прикреплённые к импортированным
ORM-моделям. Он не читает исторические SQL-миграции и не является полным описанием
схемы. Поэтому индекс, созданный непосредственно в Alembic/SQL, может отсутствовать
в metadata, даже если физически присутствует в развёрнутой схеме.

Особенно это относится к RAG: `ivfflat` использует pgvector-оператор
`vector_cosine_ops`, параметр `lists = 100` и, для контурных индексов, частичный
`WHERE contour = ...`. Для контурных RAG-индексов эти опции и идемпотентное
создание с `IF NOT EXISTS` подтверждены миграциями `0029` и `0036`, а не объектами
`Base.metadata`. Некоторые миграционные B-tree/GIN/Hash-индексы отдельно отражены
в моделях, но это совпадение источников не делает metadata полной миграцией схемы.

При изменении ORM-декларации, одного из перечисленных migration-файлов или
состава инвентаря нужно одновременно актуализировать
`tests/test_db_index_inventory.py`. Статическая проверка специально читает исходники и
не обращается к локальной или production-БД.
