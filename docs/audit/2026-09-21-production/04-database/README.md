# 04 — БД и защита данных (ticket 04)

Static-аудит локального checkout `f364388` + read-only production-metadata
(SSH, без чтения `.env`/credentials/values и без business rows).
Код продукта, схема БД и production не менялись. Секреты — только именами.
Оценки без production-доказательства помечены static/local (Решение 7).

- `db-model.md` — статическая ORM/migrations-инвентаризация: entities
  (36 declarative + 3 Core = 39 metadata), constraints, indexes, migration
  chain, R14 (роли/владение/приглашения), injection surface,
  production-каталог EV-013.
- `findings.json` — findings по схеме spec R26 (6 записей, kind не смешиваются).
- Базовые доказательства: EV-001…EV-008 (зона ticket 01); новые факты этого
  тикета — EV-009…EV-012 ниже (файлы лежат в зоне тикета, слияние индекса —
  шаг оркестратора).

## In-zone evidence (контракт: source, timestamp, target, command, exit, sanitized result)

- EV-009 — static ORM metadata: UTC 2026-09-21T17:2xZ, local, команды
  `python -c "from app.db.models import Base..."` (exit 0): 39 объектов
  `Base.metadata` = 36 declarative-классов с `__tablename__` + 3 Core
  `Table` (`role_permissions`, `user_roles`, `news_post_tags`); PK 39/39,
  FK 55, unique 17 (declarations), check 5 (declarations), NOT NULL 218,
  ORM-Index 17, вектор-колонка 1 (`rag_documents.embedding:1536`).
- EV-010 — static migrations chain: local `ls alembic/versions/` + `rg
  "revision|down_revision"` (exit 0): 35 файлов, линейная цепочка
  `0001 → ... → 0032 → 0033 → 0036_semantic → 0037` (head `0037`); номеров
  `0034/0035` никогда не существовало (нумерационный скачок, не drift).
  Downgrade-функции присутствуют (проверен `0036`, `def downgrade` есть).
  Сравнение с сервером — только parity имён файлов (см. EV-011/EV-013),
  содержимое/checksum не сравнивались.
- EV-011 — deployed file parity (SSH read-only, UTC 2026-09-21T17:29:37Z,
  target `root@213.139.209.165`, exit 0): server HEAD `f06b15c`; файловый
  набор `alembic/versions/` на сервере совпадает с локальным только по
  именам (35/35, содержимое/checksum не сравнивались); `pg_isready` —
  accepting connections; `postgres --version` — `16.10`; `env` контейнера
  `tz-prod-db-primary` — только имена ключей: `POSTGRES_DB/USER/PASSWORD`,
  `REPL_USER/REPL_PASSWORD` (значения не читались); `du` PG-данных —
  `136M` (подтверждает EV-006).
- EV-013 — production catalog (SSH read-only, UTC 2026-09-21, target
  `root@213.139.209.165`, `docker exec -i tz-prod-db-primary ... psql -f
  /dev/stdin`, exit 0; аутентификация — passthrough окружения контейнера,
   значения credentials не выводились; только SELECT, business rows не
   читались): `alembic_version` = `0037` (доказан только паритет применённой
   версии с файловым head; schema/content/manual drift — UNKNOWN,
   definitions/checksums не сравнивались); `public` BASE TABLEs 41 (= 39 ORM + `alembic_version` +
  `db_migration_log`); constraints PK 41 / FK 55 / unique 12 / check 8;
  `pg_indexes` 150 строк; роли — только имена (дефолтные `pg_*` +
  `replicator` + `technoz`); grants — только `technoz` (7 привилегий ×
  41 таблица, отдельной read-only роли нет); `pg_database_size` 33 MB;
  aggregate `count(*)` — `rag_documents` 677, `achievements` 66,
  `role_permissions` 38, `db_migration_log` 35, `refresh_tokens` 24,
  `assessment_answers`/`assessment_checkpoints` по 22, `permissions` 17,
  `questionnaire_results`/`roles` по 9, прочее — единицы и нули
  (полный перечень в `db-model.md`).
- EV-014 — R14 static (local `rg`/read, exit 0): роли — `Role`/`Permission`
  (`models.py:73-107`), Core `role_permissions_tbl`/`user_roles_tbl`
  (`models.py:48-63`), `require_role`/`has_role` (`deps.py:128-145`);
  владение — `Project.created_by` (`models.py:189`), `ProjectMember`
  (`models.py:329-351`), `can_access_project`/`require_project_access`
  (`projects.py:180-206`); приглашения — `ProjectInvite`
  (`models.py:354-380`), `require_project_admin` + endpoints
  (`invites.py:58-96,225-256`). Runtime авторизованных сценариев — UNKNOWN.
- EV-015 — targeted test run (local, UTC 2026-09-21): `cd
  technozrelost-backend && uv run pytest
  tests/test_migration_remediation.py -q` → setup ERROR
  (`psycopg.OperationalError: connection refused 127.0.0.1:5432`, нет
  локальной test DB), итог `1 warning, 1 error`; статус BLOCKED.
- EV-012 — static data-protection inventory (local `rg`, exit 0): f-string SQL
  с `SELECT/INSERT/UPDATE/DELETE` — 0 совпадений; `.format()`-SQL — 0;
  `text()` — только статические литералы (`pg_try_advisory_lock(42)`,
  `1=0`, partial-index `WHERE`); `CREATE POLICY`/`ENABLE ROW LEVEL`/`tenant_id`
  — 0 совпадений (RLS нет); bcrypt — `app/core/security.py:14`;
  TLS — `nginx.prod.conf:97-100` (`TLSv1.2 TLSv1.3`, пути к cert — именами);
  backup — `BACKUP_KEEP` default 7 + rclone crypt-guard
  (`infra/cron/check-rclone-crypt.sh`); MinIO KMS/SSE в
  `docker-compose.prod.yml` — отсутствует (0 совпадений `KMS|encrypt`).

## Покрытие DB/data-protection checklist spec (доказательно или UNKNOWN)

| Пункт | Статус |
|-------|--------|
| entities/normalization/types/PK/FK/unique/check/NOT NULL | покрыто (EV-009, `db-model.md`) |
| cascade/orphans/soft delete/audit/timestamps/enums/versioning | покрыто static: cascade — см. модель; soft delete — отсутствует repo-wide; audit — только `audit_trail` (проекты); timestamps — created/updated-серверные default |
| indexes/plans/growth/retention | частично: indexes покрыты (EV-009/EV-010); EXPLAIN/growth/retention-политики данных — UNKNOWN (EXPLAIN как нагрузочный/плановый анализ не входил в low-rate metadata repair; нагрузка запрещена) |
| migration order/reproducibility/drift/compatibility/transactions/rollback/locks/data loss/manual changes/seeds | файловый parity закрыт по именам (EV-010/EV-011: 35/35); каталогом доказан только паритет применённой версии (`0037`, EV-013) с файловым head; schema/content/manual drift — UNKNOWN, остаток в DB-01; downgrade/транзакции — static (downgrade есть) |
| TLS/encryption/key management | частично: TLS на границе (nginx) покрыт static; внутрикластерный TLS PG/MinIO, шифрование at-rest, управление ключами — UNKNOWN (values запрещены) → DB-04 |
| users/least privilege/network exposure | частично: имена ролей/кредов покрыты (EV-011, без values); содержимое `pg_hba.conf`, effective grants — UNKNOWN (resolved config запрещён) |
| RLS/tenant isolation | покрыто static: RLS отсутствует, изоляция — application-level (RBAC/ownership/invites, EV-014); runtime авторизованных сценариев — UNKNOWN → DB-02 |
| ORM injection protection | покрыто static (EV-012: ORM-only, без destructive payloads по запрету); таргет-гейт BLOCKED — нет локальной test DB (EV-015) |
| masking/access logs | masking недройдено static (сиды/refresh-token SHA-256 — `security.py:53`); access-логи БД — UNKNOWN |
| backup encryption/restore/deletion | частично: снапшоты свежие + crypt-guard offsite (EV-006/EV-012); restore не запускался (вне рамок); удаление данных/retention бизнес-строк — UNKNOWN → DB-04/DB-06 |

## Production-сопоставление (static local vs deployed)

- Код миграций на проде == локальному набору только по именам файлов
   (EV-011, 35/35; содержимое/checksum не сравнивались). Каталогом доказан
   только паритет применённой версии: `0037` == файловый head (EV-013);
   schema/content/manual drift — UNKNOWN (definitions/checksums не сравнивались).
  Остаточная неопределённость: локальный HEAD `f364388` ≠ server HEAD
  `f06b15c` (EV-001/EV-002) для немиграционного кода; модель в отчёте —
  static/local (DB-01).
- Replica: креды `REPL_USER/REPL_PASSWORD` заданы именами, но сервиса реплики
  нет (12 контейнеров EV-003) и `/ready` отдаёт `replica not_configured`
  (EV-004) → репликация подготовлена, не развёрнута → DB-05.
- Размер PG-данных 136M `du` / 33M `pg_database_size` (EV-011/EV-013) —
  размеры, не содержимое; только aggregate counts, business rows не
  собирались (запрет).

## UNKNOWN (честно недоступное)

1. Содержимое/checksum файлов миграций на проде, `pg_hba.conf`,
   effective grants сверх табличных, EXPLAIN-планы, slow queries, locks,
   connections (часть — зона operations).
2. Шифрование at-rest (PG-volume, MinIO-объекты, локальные снапшоты),
   управление ключами.
3. Ролевой/авторизованный runtime — `UNKNOWN` до test accounts (R36).
4. Retention/удаление бизнес-данных, маскирование в логах БД.

Mutations: ни одной. ПДн/секретов/бизнес-строк в артефактах нет.
