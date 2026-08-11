# SECURITY.md — Политика безопасности репозитория «Технозрелость»

> Репозиторий: `github.com/atrshncv-design/MVP-CNTR` · Платформа «Технозрелость» (ЦНТР УР, ГОСТ Р 58048-2017).
> Живая модель угроз — в [THREAT_MODEL.md](./THREAT_MODEL.md). Этот документ — политика репозитория; модель угроз — техническое приложение к ней.

## 1. Поддерживаемые версии и окружения

| Окружение | Состав | Статус поддержки |
|---|---|---|
| `dev` (локальная разработка) | Docker Compose: PostgreSQL 16 + pgvector (Primary/Replica), MinIO, ClamAV (clamd); backend FastAPI (Python 3.11+), frontend Next.js (App Router) | ✅ Поддерживается; базовая конфигурация из шаблона `.env` |
| `staging` (инсценировка) | Тот же контур, что prod; документированная инструкция развёртывания | 🚧 Документируется в тикете 05 спеки `security-infrastructure` (compose-deploy); до готовности — не является поддерживаемым окружением |
| `production` | Nginx (TLS 80/443) + frontend + backend (2 реплики) + PostgreSQL Primary/Replica + MinIO + ClamAV + Redis (зарезервирован) + Prometheus/Grafana | ⛔ **Не развёрнут.** Блокеры: сервер/доступы, SMTP, юридические тексты, второй ответственный эксплуатации (спека, Out of Scope). До их закрытия возможен release candidate, но не внешний запуск |

**Поддерживаемые компоненты и версии** (актуальные версии фиксируются в `uv.lock` / `package.json` и проверяются `uv audit` в `technozrelost-backend/scripts/security_check.py`):

- Backend: Python + FastAPI, SQLAlchemy (async), Pydantic; JWT — `python-jose` (HS256), пароли — bcrypt (`passlib`).
- БД: PostgreSQL 16 с расширением pgvector (`pgvector/pgvector:0.8.0-pg16`).
- Объектное хранилище: MinIO (закрытый бакет); антивирус: ClamAV (clamd, протокол INSTREAM).
- Frontend: Next.js (App Router), сборка standalone.

Правило: **секреты — только через переменные окружения** (`.env` / `.env.production` в `.gitignore`). Примеры значений в `app/core/config.py` — плейсхолдеры (`change_me`), никогда не реальные секреты.

## 2. Ответственное раскрытие уязвимостей (Responsible Disclosure)

Цель процесса — получить описание проблемы до того, как она станет публичной, и дать владельцам время на исправление.

### 2.1 Что делать и чего НЕ делать

**НЕ публикуйте** в issue-трекерах, чатах, публичных каналах и отчётах:

- реальные секреты, токены, пароли, ключи API (даже «потерянные»/«тестовые»);
- персональные данные (ПДн) реальных пользователей;
- готовые эксплойты и полные цепочки атаки до устранения;
- данные из продакшен-окружений (оно и так не развёрнуто; тестируйте только на dev/staging с синтетическими данными).

**Делайте:**

- проверяйте только на согласованных окружениях (dev/staging), без разрушительных нагрузок (DoS) и без доступа к чужим данным сверх необходимости;
- соблюдайте 152-ФЗ: не собирайте и не выводите реальные ПДн;
- отправляйте отчёт владельцу репозитория (см. ниже) и дайте время на исправление до публикации.

### 2.2 Куда отправлять отчёт

На текущем этапе контактная точка — **владелец репозитория** (`github.com/atrshncv-design/MVP-CNTR`). Способ передачи — приватный канал (личное сообщение владельцу; при появлении выделенного почтового ящика/security-процесса контакт будет обновлён здесь). Отчёт отправляйте по шаблону раздела 2.3. В теме письма/сообщения укажите `[SECURITY]`.

Ожидания по срокам (внутренний процесс; точные SLA фиксируются при вводе эксплуатации):

- подтверждение получения — в течение 3 рабочих дней;
- триаж и предварительная оценка — до 7 рабочих дней;
- статус исправления и, при необходимости, скоординированное раскрытие — по результатам триажа.

### 2.3 Шаблон отчёта

**RU:**

```text
[SECURITY] Краткое название (например: IDOR: чтение файлов чужого проекта)

1. Тип уязвимости: (IDOR / enumeration / privilege escalation / injection /
   XSS / CSRF / malware-upload / DoW / secrets / backup / иное)
2. Endpoint(-ы): (метод + путь, например POST /api/v1/projects/{id}/files)
3. Затронутые данные/активы: (что именно пострадало)
4. Воздействие: (что может сделать злоумышленник; оценка severity)
5. Воспроизведение: (шаги 1..N, минимальный пример; БЕЗ реальных секретов/ПДн)
6. Окружение: (dev/staging; версии компонентов)
7. Предложенное исправление: (опционально)
```

**EN:**

```text
[SECURITY] Short title (e.g., IDOR: reading another project's files)

1. Vulnerability type: (IDOR / enumeration / privilege escalation / injection /
   XSS / CSRF / malware-upload / DoW / secrets / backup / other)
2. Endpoint(s): (method + path, e.g. POST /api/v1/projects/{id}/files)
3. Affected data/assets:
4. Impact: (what an attacker can do; severity estimate)
5. Reproduction: (steps 1..N, minimal example; NO real secrets/PII)
6. Environment: (dev/staging; component versions)
7. Suggested fix: (optional)
```

### 2.4 Что происходит после отчёта

1. Подтверждение получения и присвоение идентификатора.
2. Триаж: воспроизведение на dev/staging (синтетические данные), классификация, приоритет.
3. Исправление + регрессионный тест (security-sensitive изменение **обязано** обновить THREAT_MODEL.md или обосновать отсутствие изменений — см. THREAT_MODEL.md, раздел «Как обновлять модель»).
4. Скоординированное раскрытие: после выхода исправления информация может быть опубликована (без секретов и ПДн).

## 3. Принципы безопасности (обязательные для всех изменений)

### 3.1 Секреты — только в окружении

- Никаких секретов в репозитории: `.env`/`.env.production` в `.gitignore`; конфигурация — `pydantic-settings` из переменных окружения.
- В логах секреты маскируются: JSON-логирование с `redact()` (`app/core/logging_config.py`): токены, пароли, ключи, Authorization-заголовки и e-mail.
- Refresh-токены хранятся в БД только как SHA-256 хеш (`hash_token`), отзываются при ротации.
- Скан на секреты: `technozrelost-backend/scripts/security_check.py` (git-tracked файлы, шаблоны `api_key/secret/password/token/bearer`); в CI — тикет 04 спеки.

### 3.2 Code review и security-гейты

- Каждое изменение проходит review перед merge; контракт репозитория: 1 коммит = 1 тикет.
- Существующие тесты не ломаются; security-sensitive код сопровождается тестами (RBAC/IDOR/upload-кейсы покрыты в `tests/`: `test_rbac_projects.py`, `test_file_storage.py`, `test_auth_refresh.py`, `test_publication_privacy.py` и др.).
- Гейты качества: ruff, pyright, полный изолированный pytest.
- Автоматические security-гейты CI (SAST/SCA/DAST/секрет-история/SBOM) — тикет 04 спеки (planned); текущий ручной слой — `security_check.py` (тикет 21): secrets-scan, `uv audit`, live RBAC/IDOR/file-проверки.

### 3.3 Доступ по минимуму и защита от IDOR

- RBAC: `require_role` / `has_role` / `is_cntr_staff` (`app/core/deps.py`); 9 платформенных ролей + суперпользователь; staff-роли (`cntr_admin`, `cntr_manager`) нельзя получить саморегистрацией.
- Доступ к объектам проекта — только через `require_project_access` (`app/api/v1/projects.py`): суперпользователь / персонал ЦНТР / создатель / активный участник; нарушителю — **404, а не 403** (существование объекта не раскрывается).
- Проектное полномочие `project_admin` — отдельный флаг участника, передаётся осознанно (`app/api/v1/invites.py`).
- Публикуются в публичных реестрах только объекты с явным флагом `is_public` / статусом `verified`.

### 3.4 Аудит и удаления

- `AuditTrailEntry` (таблица `audit_trail`) — append-only на уровне API: записи только добавляются бизнес-логикой; чтение — `GET /api/v1/admin/audit` только для `cntr_admin`.
- Удаления: жёстко удаляется только пустой черновик без документов; верифицированные/опубликованные проекты — архивируются (`status=archived`, снятие с публикации); версии документов, зафиксированные в снимках заявок, защищены от очистки.
- Срок хранения аудита (12 месяцев) и observability — тикет 03 спеки (planned).

### 3.5 AI-изоляция

- AI-консультант (`/api/v1/chat`) читает только `rag_documents` (подтверждённую базу знаний методологии); проекты, файлы, заявки и ПДн в контекст LLM **не попадают**.
- AI не изменяет данные платформы (read-only справочный слой); лимит запросов — 30 req/60 с на пользователя (429).
- Закрытые коммерческие данные пользователей не передаются внешнему LLM-провайдеру (допущение спеки; инвариант I-2 в THREAT_MODEL.md).

### 3.6 Deploy

- TLS (443) на Nginx; наружу публикуются только 80/443; внутренние сервисы — `expose` во внутренней сети Docker.
- Секреты — по сервисам через `.env.production`; health/readiness у всех сервисов; бэкап БД перед миграциями (тикет 06 спеки — восстановление).
- Production deploy не выполняется без явного разрешения (тикет 05 спеки: только документированный staging/инструкция).

## 4. Связанные документы и тикеты

- [THREAT_MODEL.md](./THREAT_MODEL.md) — активы, акторы, trust boundaries, abuse cases, контроли, инварианты, residual risks, процедура обновления.
- Спека `security-infrastructure` (`.scratch/security-infrastructure/spec.md`): тикеты 02 (secure-uploads/карантин), 03 (audit/observability), 04 (security CI), 05 (compose-deploy), 06 (backup/restore), 07 (capacity), 08 (Kali-пентест staging).
- `technozrelost-backend/scripts/security_check.py` — security harness (тикет 21): secrets/deps/RBAC/IDOR/file.
