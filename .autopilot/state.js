window.STATE =
{
  "slug": "audit-remediation",
  "dir": "2026-09-08-audit-remediation",
  "title": "Спека и таски исправлений по аудиту aeecb2d",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T3",
  "briefFile": "2026-09-08-brief.md",
  "memoryFile": "AGENTS.md",
  "skillDir": "/Users/aleksandrtrisenkov/.agents/skills/autopilot",
  "startedAt": "2026-09-08T08:43:09+04:00",
  "updatedAt": "2026-09-09T10:09:04+04:00",
  "finishedAt": "2026-09-09T10:09:04+04:00",
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-09-08T08:43:09+04:00", "finishedAt": "2026-09-08T08:44:00+04:00" },
    { "id": "manifest", "status": "done", "startedAt": "2026-09-08T08:44:00+04:00", "finishedAt": "2026-09-08T08:46:49+04:00", "note": "7 требований" },
    { "id": "briefing", "status": "done", "startedAt": "2026-09-08T08:44:00+04:00", "finishedAt": "2026-09-08T08:46:49+04:00", "note": "охват: всё + приоритеты" },
    { "id": "spec", "status": "done", "startedAt": "2026-09-08T08:46:49+04:00", "finishedAt": "2026-09-08T08:49:05+04:00", "note": "G2 pass" },
    { "id": "plan", "status": "done", "startedAt": "2026-09-08T08:49:05+04:00", "finishedAt": "2026-09-08T08:51:41+04:00", "note": "16 тасков, ярус T3" },
    { "id": "build", "status": "done", "startedAt": "2026-09-09T09:57:06+04:00", "finishedAt": "2026-09-09T10:09:04+04:00", "note": "доделка zh: таск 19 готов" },
    { "id": "review", "status": "done", "startedAt": "2026-09-09T10:09:04+04:00", "finishedAt": "2026-09-09T10:09:04+04:00", "note": "проверен таск 19, блокеров нет" },
    { "id": "final", "status": "done", "startedAt": "2026-09-09T10:09:04+04:00", "finishedAt": "2026-09-09T10:09:04+04:00", "note": "дельта-приёмка pass" }
  ],
  "requirements": {
    "total": 9, "done": 5, "inTicket": 0, "inSpec": 2,
    "placeholder": 0, "deferred": 0, "dropped": 2
  },
  "tickets": [
    { "id": "01", "title": "Redis как обязательная прод-зависимость", "requirements": ["R03i"], "blockedBy": [], "wave": 1, "zone": ["backend/deps", "backend/health", "infra/compose"], "status": "done", "startedAt": "2026-09-08T08:57:36+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 23, "failed": 0 }, "commit": "99a4887" },
    { "id": "02", "title": "Метрики с ограниченной кардинальностью", "requirements": ["R03i"], "blockedBy": [], "wave": 1, "zone": ["backend/observe"], "status": "done", "startedAt": "2026-09-08T08:57:36+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 12, "failed": 0 }, "commit": "ecb8a43" },
    { "id": "03", "title": "Закрытая выдача привилегированных ролей", "requirements": ["R04i"], "blockedBy": [], "wave": 1, "zone": ["backend/auth"], "status": "done", "startedAt": "2026-09-08T08:57:36+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 11, "failed": 0 }, "commit": "f24dd69" },
    { "id": "04", "title": "SSE по одноразовому ticket вместо токена в URL", "requirements": ["R04i"], "blockedBy": [], "wave": 1, "zone": ["backend/realtime", "frontend/notify", "infra/nginx"], "status": "done", "startedAt": "2026-09-08T09:05:00+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 10, "failed": 0 }, "commit": "31dbb8a" },
    { "id": "05", "title": "Честные лимиты и закрытый реестр специалистов", "requirements": ["R05i"], "blockedBy": [], "wave": 1, "zone": ["backend/registry"], "status": "done", "startedAt": "2026-09-08T09:05:00+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 23, "failed": 0 }, "commit": "cb654e2" },
    { "id": "06", "title": "Атомарная ротация refresh-токенов", "requirements": ["R05i"], "blockedBy": ["03"], "wave": 2, "zone": ["backend/auth"], "status": "done", "startedAt": "2026-09-08T09:36:46+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 3, "failed": 0 }, "commit": "a9f0b54" },
    { "id": "07", "title": "Лимит тела запроса на балансировщике под загрузки", "requirements": ["R05i"], "blockedBy": ["04"], "wave": 2, "zone": ["infra/nginx"], "status": "done", "startedAt": "2026-09-08T09:36:46+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 3, "failed": 0 }, "commit": "d7877d6" },
    { "id": "09", "title": "Миграции только с готовым бэкапом", "requirements": ["R05i"], "blockedBy": [], "wave": 2, "zone": ["infra/backup"], "status": "done", "startedAt": "2026-09-08T09:36:46+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 61, "failed": 0 }, "commit": "eabcb41" },
    { "id": "10", "title": "Offline-очередь без секретов и потерь", "requirements": ["R05i"], "blockedBy": [], "wave": 2, "zone": ["frontend/offline"], "status": "done", "startedAt": "2026-09-08T09:42:40+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 154, "failed": 0 }, "commit": "fee9778" },
    { "id": "11", "title": "LLM-путь: очередь, изоляция промпта, строгий парсинг", "requirements": ["R05i"], "blockedBy": [], "wave": 2, "zone": ["backend/ai"], "status": "done", "startedAt": "2026-09-08T09:42:40+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 1, "handoffs": 0, "tests": { "passed": 5, "failed": 0 }, "commit": "7ddd15d", "repairFindings": ["красный test_project_event_reaches_manager: парсинг отверг формат SUCCESS:… — принят токен с границей слова"] },
    { "id": "13", "title": "Витрина лендинга на живых данных реестра", "requirements": ["R06i"], "blockedBy": [], "wave": 2, "zone": ["frontend/landing"], "status": "done", "startedAt": "2026-09-08T09:42:40+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 162, "failed": 0 }, "commit": "97aca62" },
    { "id": "12", "title": "Настоящие эмбеддинги и честный rerank", "requirements": ["R05i"], "blockedBy": ["11"], "wave": 3, "zone": ["backend/ai", "db/rag"], "status": "done", "startedAt": "2026-09-08T09:49:53+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 4, "failed": 0 }, "commit": "3906e13" },
    { "id": "14", "title": "Пакет P2: пагинация, N+1, CHECK, readiness, секреты", "requirements": ["R06i"], "blockedBy": [], "wave": 3, "zone": ["backend/admin", "backend/teams", "db/core", "infra/compose"], "status": "done", "startedAt": "2026-09-08T09:49:53+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 18, "failed": 0 }, "commit": "ae0166d" },
    { "id": "08", "title": "Зелёные гейты: линт, типы, сюита, сборки", "requirements": ["R05i"], "blockedBy": ["15", "16"], "wave": 4, "zone": ["tests/gates", "ci"], "status": "done", "startedAt": "2026-09-08T10:20:00+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 5, "failed": 0 }, "commit": "bb52eff" },
    { "id": "15", "title": "Пакет P3 (приложение): инвайты, CSP, CSRF", "requirements": ["R06i"], "blockedBy": ["14"], "wave": 4, "zone": ["backend/teams", "frontend/shell", "docs"], "status": "done", "startedAt": "2026-09-08T10:02:13+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 8, "failed": 0 }, "commit": "75be366" },
    { "id": "16", "title": "Пакет P3 (инфра): restore, WAL, алерты, мониторинг, деплой", "requirements": ["R06i"], "blockedBy": ["09", "14"], "wave": 4, "zone": ["infra/backup", "infra/observe", "infra/deploy"], "status": "done", "startedAt": "2026-09-08T10:02:13+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 101, "failed": 0 }, "commit": "9659116" },
    { "id": "17", "title": "Локализация интерфейса на китайский", "requirements": ["G01"], "blockedBy": [], "wave": 4, "zone": ["frontend/i18n"], "status": "done", "startedAt": "2026-09-08T10:41:29+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 1, "handoffs": 0, "tests": { "passed": 6, "failed": 0 }, "commit": "e3244b3", "repairFindings": ["контент методологии оставался английским: переведены все неймспейсы, EN-хардкод убран в словарь"] },
    { "id": "18", "title": "Локализация интерфейса на хинди", "requirements": ["G02"], "blockedBy": ["17"], "wave": 5, "zone": ["frontend/i18n"], "status": "done", "startedAt": "2026-09-08T10:47:57+04:00", "finishedAt": "2026-09-09T09:19:39+04:00", "retries": 0, "repairs": 1, "handoffs": 0, "tests": { "passed": 7, "failed": 0 }, "commit": "43c38ae", "repairFindings": ["контент методологии оставался английским: полный перевод + allowlist пинов"] },
    { "id": "19", "title": "Китайский до конца: ноль fallback, паритет текущих ключей", "requirements": ["G01"], "blockedBy": [], "wave": 6, "zone": ["frontend/i18n"], "status": "done", "startedAt": "2026-09-09T09:57:06+04:00", "finishedAt": "2026-09-09T10:09:04+04:00", "retries": 0, "repairs": 0, "handoffs": 0, "tests": { "passed": 11, "failed": 0 }, "commit": "5b1e63e" }
  ],
  "singlePass": null,
  "tests": null,
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": ["REDIS_URL (prod)", "LLM_API_KEY (optional)"] },
  "additions": [],
  "coverage": {
    "firstPassFindings": 0,
    "fixed": 0,
    "recheckFindings": 0,
    "status": "pass",
    "extra": 0,
    "extraNote": "G2 independent: missing 0, half-covered 0; раздел 3 (в спеке, нет в брифе) разобран — всё природителено к Дополнениям брифа (аудит aeecb2d + решение «Всё + приоритеты»), A## без родителя нет, вырезать нечего"
  },
  "concerns": [
    "health.py readiness тянет проверки чужих зон — один владелец readiness на следующий заход",
    "tests/support ADMIN_ASSIGNED_SLUGS дублирует PRIVILEGED_ROLE_SLUGS — один источник",
    "тесты test_redis_obligatory/test_observability/test_sse_ticket утверждают внутренности вместо шва HTTP",
    "executors.py: дублированный фильтр org поверх role/cursor",
    "embeddings: VECTOR_DIM/EMBEDDING_DIM дубль; имя semantic-ru-v2 overpromises; matching глотает исключения",
    "test_semantic_embeddings: фикстура зависит от порядка; requests.py ручной CommentOut с заглушкой",
    "test_p2_package зеленеет на пустом списке; csp-тест грепет исходник; restore.sh дубль проверки пустой БД; alerter импорт внутри функции",
    "infra-тесты читают тексты скриптов вместо кодов возврата; backup-lock флаги шире interfaces; stages-парсер шире ровно-SUCCESS (требует старый формат)",
    "showcase fetchRegistryPage дублирует шов; landing два сборщика query; landing-тесты грепят исходники",
    "ci_gates-тест слабые подстроки; LocaleToggle-литералы и тернарник layout; translators if-цепочка; hi-allowlist JSON vs zh-inline",
    "ru/en +12 ключей витрины без синхронного zh/hi (покрыто EN-fallback)",
    "clamav-контейнер unhealthy на демо-стенде — вне объёма прогона, чинить отдельно",
    "zh-тест живого рендера грепает словарь, второй список акронимов дублирует TERMS (T19)"
  ],
  "reviewers": { "manifestSpec": "ses_f805caf87ffe7VZYPKHzOp56Vn", "craft": "ses_f805caf73ffe2mPQX0k2JN1mKZ" },
  "blind": {
    "status": "pass",
    "summary": "дельта: G01-доделка реализована, G02-отмена соблюдена (hi-код инертный); расхождений с манифестом нет",
    "open": []
  }
}
