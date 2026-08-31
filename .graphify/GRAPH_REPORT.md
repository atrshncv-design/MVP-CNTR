# Graph Report - .  (2026-08-28)

## Corpus Check
- 451 files · ~244,932 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2564 nodes · 5942 edges · 154 communities detected
- Extraction: 80% EXTRACTED · 20% INFERRED · 0% AMBIGUOUS · INFERRED: 1186 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output
- Edge kinds: contains: 1716 · calls: 1255 · uses: 1186 · MODIFIES: 524 · rationale_for: 416 · imports_from: 260 · imports: 149 · inherits: 138 · ON_BRANCH: 99 · re_exports: 66 · PARENT_OF: 56 · references: 48 · method: 29


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 451 · Candidates: 530
- Excluded: 47 untracked · 41863 ignored · 6 sensitive · 4 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `e0a8312`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `User` - 93 edges
2. `Project` - 89 edges
3. `ProjectMember` - 59 edges
4. `ProjectDocument` - 42 edges
5. `PromotionRequest` - 40 edges
6. `Base` - 38 edges
7. `read_text()` - 38 edges
8. `CLIENT_API_BASE` - 35 edges
9. `FileStorageError` - 33 edges
10. `AuditTrailEntry` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Токен опционален: публичные эндпоинты (реестры) работают без авторизации.` --uses--> `User`  [INFERRED]
  technozrelost-backend/app/core/deps.py → technozrelost-backend/app/db/models.py
- `True, если у пользователя есть хотя бы одна из ролей (или он суперпользователь).` --uses--> `User`  [INFERRED]
  technozrelost-backend/app/core/deps.py → technozrelost-backend/app/db/models.py
- `Каталог достижений: идемпотентный seed 66 медалей (тикет 01, спека §4.2).  Едины` --uses--> `Achievement`  [INFERRED]
  technozrelost-backend/app/db/seed_achievements.py → technozrelost-backend/app/db/models.py
- `Идемпотентный upsert каталога (ON CONFLICT (slug) DO UPDATE).      Возвращает ит` --uses--> `Achievement`  [INFERRED]
  technozrelost-backend/app/db/seed_achievements.py → technozrelost-backend/app/db/models.py
- `Seed RAG templates into the database.  Usage:     uv run python app/db/seed_temp` --uses--> `RagDocument`  [INFERRED]
  technozrelost-backend/app/db/seed_templates.py → technozrelost-backend/app/db/models.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (67): 43a98ce chore: консолидация базы аудита — фронт из codex/frontend-design-baseline (a05e6a6) поверх friday-rc + env-шаблоны и незакоммиченный notification-bell, Doc100Icon(), Doc10Icon(), Doc25Icon(), Doc50Icon(), Doc5Icon(), DocFirstIcon(), M15MedalsIcon() (+59 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (47): INITIAL_ASSISTANT_MESSAGE, Message, Source, ControlPoint, CP_STATUS_COLORS, CP_STATUS_LABELS, DECIDED_STATUSES, PROJECT_STATUS_COLORS (+39 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (77): AchievementManagerReview, AchievementStalledProject, AchievementStatsGroupItem, AchievementStatsPoint, AchievementStatsSectorItem, AchievementStatsTotals, AchievementTopItem, ChatIn (+69 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (68): NewsCardOut, NewsCategoryOut, NewsCreateIn, NewsDetailOut, NewsFeedOut, NewsMediaOut, NewsScheduleIn, NewsTagOut (+60 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (16): Alembic environment for the Technozrelost backend.  Миграции используют **синхро, Technozrelost backend package., 9e6cccc release(friday-rc): актуальный полный код 22/22 — backend + frontend + docs (снапшот 06.08.2026, 591 файл), admin_credentials(), seed(), AXES, Status, Операционные скрипты backend (нагрузочный и security harness, тикет 21). (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (51): backup_environment(), compose_default_subnet(), compose_service_block(), hba_records(), install_backup_stubs(), production_env_file(), read_text(), run_backup() (+43 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (27): cc71174 feat(m0): harden infra replication/HBA/WAL/backups + finalize docs and memory, STATUS_BADGE, ApiError, apiRequest(), getProjects(), getPublicNewsCategories(), getPublicNewsDetail(), getPublicNewsFeed() (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (42): bench_login(), _bucket_stats(), _build_parser(), compute_report(), _do_request(), _fmt_report(), _load_users(), main() (+34 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (44): NioktrCard, Organization, Technology, _iso_clean(), _org_type(), Импорт полного массива НИОКТР в реестры: organizations + nioktr_cards.  Использо, ISO-даты из источника: обрезаем до YYYY-MM-DD, если есть время., seed() (+36 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (44): Achievement, ProjectAchievement, ProjectDocument, PromotionRequest, Медаль каталога достижений (спека §4.2).      Каталог наполняется идемпотентным, Персональная медаль пользователя (спека §4.2).      Дедупликация «один раз за со, Командная медаль проекта (спека §4.2). UNIQUE (project_id, achievement_id)., UserAchievement (+36 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (42): autopilot/m0-security-hardening, main, 00f9718 docs: update Plan.md (Phase 2 done) and Status.md (Phase 2 report), 03e5366 feat(news): тикет 08 — GET /news/admin-list (cntr_admin — все, cntr_manager — свои) + 3 теста, 058ba9d docs(status): verification-docs visibility fix (80 tests, backend live), 083f89d docs: import MVP-0 frontend source and project context, 088b40c docs: update Plan.md + Status.md — Phase 2 complete, 0e612c9 chore: таск 02 — гигиена репозитория: вывод 294 легаси-файлов (MVP-0, docs/.scratch), .gitignore, карта версий docs/version-map.md (+34 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (39): _auth(), _db(), _email(), _fetch(), _join_active_member(), _mock_llm_ok(), _project_medal_slugs(), _promotion_request() (+31 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (37): aggregate_state(), AlerterConfig, AlertState, check_backup_freshness(), check_clamav_availability(), check_disk_usage(), _check_http_endpoint(), check_minio_health() (+29 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (19): ProjectFile, SCAN_LABELS, Invite, Comment, ProjectRequest, STATUS_LABELS, Evaluation, Requirement (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (27): ascan_file(), astore_news_media(), astore_project_file(), ClamAvScanner, detect_mime(), extension_for(), ObjectStorage, Безопасное файловое хранилище (тикет 06 Friday RC).  - Фактический MIME определя (+19 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (19): BaseSettings, get_settings(), Прод-guard (R05.2): в production дефолтный/пустой JWT-секрет запрещён., Settings, Конфигурация подключения к БД (тикет 18): Primary/Replica DSN.  DATABASE_URL / D, Тикет 01 — LLM-гейтвей N-05: контур без PII.  Гейтвей выключен по умолчанию (Set, При включённом гейтвее без ключа — всё равно None (нет утечки)., При LLM_GATEWAY_ENABLED=true и ключе — внешний вызов разрешён. (+11 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (34): CommentIn, CommentOut, ExecutorOut, RequestOut, Project, ProjectMember, Комментарий к конкретной заявке на повышение УГТ (тикет 09, US 53)., RequestComment (+26 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (27): isAdmin(), isStaff(), localDateTimeMin(), NewsAdminConsolePage(), NewsRow(), STATUS_BADGE, STATUS_FILTERS, localDateTimeMin() (+19 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (16): NODES, SECTIONS, MORE_LINKS, PRIMARY_LINKS, ALL_ROLES, allowedRolesFor(), COMPILED_ROUTES, EXACT_ONLY_ROUTES (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (28): ManagerTaskOut, Notification, NotificationOutbox, Transactional outbox: realtime-события и задачи менеджеров (тикет 12)., claim_next_task(), notify_managers(), notify_news_published(), notify_user() (+20 more)

### Community 20 - "Community 20"
Cohesion: 0.20
Nodes (28): _auth(), _create_news(), _email(), Новостной раздел: публичная лента, права, статусы, media (тикет 05).  Паттерны:, Превышение лимита — тот же класс, что в files.py: 413, а не 422., Категория для тестов (conftest TRUNCATE стирает seed миграции)., _register(), _seed_category() (+20 more)

### Community 21 - "Community 21"
Cohesion: 0.43
Nodes (28): AuditTrailEntryOut, ControlPointDecisionIn, ControlPointOut, ProjectCreateIn, ProjectDetailOut, ProjectDocumentOut, ProjectMemberOut, ProjectOut (+20 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (22): AssessmentIn, DraftProjectOut, ReadinessResultOut, AssessmentAnswer, AssessmentCheckpoint, AssessmentTemplate, Base, generate_join_token() (+14 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (20): easeOutExpo, LevelDetailInteractive(), ugtColor(), PHASES, ugtColor(), UGTInteractiveScale(), DeliverableDoc, RiskItem (+12 more)

### Community 24 - "Community 24"
Cohesion: 0.08
Nodes (17): AnswerState, AnswerStatus, AssessmentTemplate, Checkpoint, Dimension, DIMENSION_CONFIG, EVIDENCE_SCORE, EvidenceRequirement (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (24): _achievement_id(), _auth(), _db(), _email(), _fetch(), _get_stats(), _insert_project(), _insert_project_achievement() (+16 more)

### Community 26 - "Community 26"
Cohesion: 0.24
Nodes (23): _active_user_ids(), _auth(), _create_news(), _db_conn(), _email(), _news_notification_counts(), _news_titles(), Тикет 06: отложенная публикация новостей и уведомления (спека §3.4, §3.6).  Покр (+15 more)

### Community 27 - "Community 27"
Cohesion: 0.21
Nodes (22): _auth(), _author_flow(), _clean_flow(), _email(), _mock_llm_ok(), _mock_scanner(), _published_project(), Тикет 07 Friday RC: универсальные комплекты и автозаявка.  Покрытие: файловая за (+14 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (23): archive_project(), _at_out(), can_access_project(), compute_current_level(), _cp_out(), create_project(), decide_control_point(), delete_project() (+15 more)

### Community 29 - "Community 29"
Cohesion: 0.09
Nodes (11): easeOutExpo, easeSmooth, fadeUp, MATRIX_DATA, PROCESS_STEPS, QUICK_NAV, staggerContainer, staggerItem (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.22
Nodes (21): AchievementCatalogOut, AchievementOut, AchievementProgressOut, ProjectAchievementOut, Запись публичного каталога достижений (спека §4.2).      Секретные медали (secre, Медаль каталога, вложенная в витрину (mine / project-achievements)., Прогресс до следующей ступени пороговой медали (doc-*/m-*).      ``current_count, Персональная медаль в витрине пользователя (спека §4.6).      ``progress`` запол (+13 more)

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (21): AdminAchievementsStatsOut, Ответ GET /admin/achievements/stats (спека §4.7)., StageDocumentIn, StageEvaluateOut, StageRequirementOut, AuditTrailEntry, PromotionRequestDocument, Неизменяемый снимок версий документов заявки (тикет 07). (+13 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (9): 6475946 feat(frontend): таск 09 — меню ЛК по кнопке «Больше функций» (порт UX из codex/internal-ux-redesign): header-nav/mobile-nav/more-functions-menu, ролевая фильтрация least-privileged; достижения и новости на месте, a7dfbf3 Merge remote-tracking branch 'origin/autopilot/deploy-readiness-code', HeaderNavItem, coreNavigation, DashboardLayout(), initials(), getVisibleMenuItems(), MORE_MENU_ITEMS (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.30
Nodes (21): _approve_draft(), _assessment(), _auth(), _get_join_token(), _published_project(), Новое ядро (тикеты 20-25): экспресс-оценка, очереди менеджера, автозаявка, реест, _register(), test_assessment_403_after_real_project() (+13 more)

### Community 35 - "Community 35"
Cohesion: 0.11
Nodes (10): easeBounce, easeOutExpo, easeSmooth, getProbabilityConfig(), PRESETS, RiskCard(), RoadmapNode(), TransitionCard() (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (11): 0bf67bf perf: таск 06 — пул БД, bcrypt в threadpool, N+1 карточки проекта, миграция 0027 (6 индексов + дроп поглощённого), loadtest на /api/v1; нагрузочный прогон: p95 ≤ 56 мс @ 60 пользователей, 26912e9 chore: план прогона m0-security-hardening — реестр находок аудита (65), дорожная карта до декабря, спека и 6 тасков гейта G1, 32b3985 fix(backend): таск 01 — N-01 серверная HMAC-атрибуция вместо клиентского shared_by, N-02 ревок всех refresh при смене пароля + logout, N-04 лимитированный читатель на stage-document-file и chunked-bypass body-limit, P-01 пул 10+20×2 с guard-тестом формулы, acbc080 chore: таск 08 — полировка приёмки: self-signed ключи вне git (+генерация в deploy.sh), легаси-линия app//db//alembic//tests удалена (-8186 строк), oversize media 413, гард синхронизации каталога медалей, e0a8312 feat(m1): 01 LLM gateway N-05 flag (T2 M1 5K) — llm_gateway_enabled false, Размер пула соединений БД: из настроек и под контролем guard-формулы (P-01).  Ис, Guard-формула (R14): пулы всех процессов + резерв строго меньше лимита БД., test_pool_budget_fits_postgres_max_connections() (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (13): 4e570d0 ci: таск 06 — workflow и strict mypy, _compact_card(), Предобработка массива НИОКТР: фильтрация и компактная выборка для демо.  Использ, Оставляет только нужные поля карточки НИОКТР., Seed RAG templates into the database.  Usage:     uv run python app/db/seed_temp, ask_llm(), _llm_config(), process_chat() (+5 more)

### Community 38 - "Community 38"
Cohesion: 0.30
Nodes (19): _auth(), _create_project(), Механика вступления по join-токену: авто-вступление, заявки, приоритет, регенера, Легитимный путь атрибуции: приоритетный участник получает подпись у сервера., N-01: подставной в теле shared_by приоритетного участника не открывает модерацию, N-01: самодельная/подделанная подпись не проходит проверку сервером., _register(), _share_sig() (+11 more)

### Community 39 - "Community 39"
Cohesion: 0.17
Nodes (18): _auth(), _email(), _mock_llm_ok(), _mock_scanner(), Тикет 12 Friday RC: realtime-уведомления и распределение задач.  Покрытие: - Про, Общее событие пишется в outbox (general scope, pending)., Атомарность: из двух менеджеров задачу забирает ровно один., Администратор видит очередь и переназначает задачу. (+10 more)

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (19): _apply_decision(), create_organization(), _get_membership(), _get_own_profile(), join_organization(), manager_decide_org(), manager_decide_profile(), manager_org_queue() (+11 more)

### Community 41 - "Community 41"
Cohesion: 0.11
Nodes (7): metadata, POINTS, CUSTOMERS, metadata, metadata, metadata, PERFORMERS

### Community 42 - "Community 42"
Cohesion: 0.18
Nodes (18): audit(), close_passed(), cmdline(), fail(), free_port(), http_ok(), is_ours(), main() (+10 more)

### Community 43 - "Community 43"
Cohesion: 0.13
Nodes (12): JsonFormatter, Структурированные JSON-логи без секретов (тикет 20).  - `setup_logging()` — один, Маскирует секреты и персональные данные в произвольной строке лога.      Порядок, Одна JSON-строка на запись лога; message и exc проходят через redact()., Настраивает JSON-логирование на root + логгеры uvicorn.      Вызывается при импо, redact(), setup_logging(), _metric_value() (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.13
Nodes (16): _before_cursor_execute(), db_query_error_observed(), db_query_observed(), _fmt(), _handle_error(), install_db_listeners(), observe_http(), PrometheusMetricsMiddleware (+8 more)

### Community 45 - "Community 45"
Cohesion: 0.28
Nodes (18): _assess(), _auth(), _email(), _levels(), Тикет 05 Friday RC: опросник и официальный УГТ до 2.  Покрытие: детерминированны, Первичное подтверждение: менеджер присваивает заявленный уровень (US 59)., Реестр фильтрует и сортирует по подтверждённому УГТ (не смешивание)., Непрерывность: preliminary N требует выполнения уровней 1..N. (+10 more)

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (18): _auth(), _create_and_confirm_ugt2(), _email(), Тикет 10 Friday RC: публичная карточка, реестры, приватность.  Покрытие: - УГТ 1, Скрытие проекта убирает его из реестра., Предварительный уровень скрыт при show_preliminary=False., Фильтры используют подтверждённый current_level; УГТ 2 не попадает в ?ugt_min=7., Публикация посторонним → 403/404. (+10 more)

### Community 47 - "Community 47"
Cohesion: 0.12
Nodes (11): Medal(), MedalProps, MedalRarity, MedalSize, MedalState, AchievementItem, GROUP_LABELS, UserAchievementOut (+3 more)

### Community 48 - "Community 48"
Cohesion: 0.17
Nodes (17): _auth(), Контракто-тесты форм ответов под фронтовые типы (deploy-readiness).  Эталон — te, GET /news → NewsFeed{items[NewsCard],total,page,per_page} без лишних полей., GET /news/{id} → NewsDetail = NewsCard + контентные поля + media[]., GET /news/categories → NewsCategory[{id,slug,name}] (публичный)., GET /achievements/catalog → [{...66 медалей}] с точным набором полей., GET /achievements/mine → UserAchievementOut[] (achievements-showcase.tsx)., Каталог 66 медалей (conftest truncate'ит achievements после теста). (+9 more)

### Community 49 - "Community 49"
Cohesion: 0.13
Nodes (10): badge, budget(), CntrManagerDashboard(), Draft, Project, Promotion, statusLabels, Tab (+2 more)

### Community 50 - "Community 50"
Cohesion: 0.24
Nodes (16): _auth(), _email(), Тикет 14 Friday RC: отказоустойчивый AI-консультант.  Покрытие: - Ответы содержа, Отдельные метрики AI-консультанта доступны., Лимит запросов: превышение окна → 429., Стаб провайдера: live-LLM в основных тестах не вызывается., Ответ содержит reply и список источников (RAG)., Ошибка провайдера не ломает платформу: fallback-ответ 200. (+8 more)

### Community 51 - "Community 51"
Cohesion: 0.35
Nodes (16): _auth(), _draft(), _email(), _promotion_request(), Тикет 08 Friday RC: менеджерская верификация УГТ.  Покрытие: первичное подтвержд, Уровень проекта изменился → заявка 2→3 устарела (409)., Комплект полон → автозаявка на повышение (LLM недоступен → пред. оценка)., _register() (+8 more)

### Community 52 - "Community 52"
Cohesion: 0.34
Nodes (16): _auth(), _email(), _get_profile(), Тикет 03 Friday RC: личные профили, организации, членство, проверка менеджером., _register(), _register_manager(), test_executors_catalog_excludes_unverified_profiles(), test_organization_create_and_multi_membership() (+8 more)

### Community 53 - "Community 53"
Cohesion: 0.13
Nodes (7): AchievementsAnalytics(), AchievementStats, AdminUser, formatHours(), GROUP_LABELS, RARITY_COLORS, RARITY_LABELS

### Community 54 - "Community 54"
Cohesion: 0.18
Nodes (11): metadata, STEPS, formatBudget(), ProjectCard(), ProjectModal(), STATUS_COLORS, STATUS_LABELS, ugtColor() (+3 more)

### Community 55 - "Community 55"
Cohesion: 0.38
Nodes (15): _auth(), _create_project(), _email(), Тикет 06 Friday RC: безопасное файловое хранилище.  Покрытие: допустимые форматы, Content-Type говорит image/png, сигнатура — исполняемый файл., _register(), test_download_and_list_restricted_to_participants(), test_download_returns_content() (+7 more)

### Community 56 - "Community 56"
Cohesion: 0.14
Nodes (5): lifespan(), LimitRequestBodyMiddleware, _news_scheduler_loop(), Чистый ASGI-middleware: контроль над receive без приватных атрибутов Request., Отложенная публикация новостей: раз в 60 секунд.      Статус в БД — источник ист

### Community 57 - "Community 57"
Cohesion: 0.24
Nodes (14): RagDocument, chunk_text(), extract_docx_text(), extract_pdf_text(), extract_text(), find_doc_sources(), ingest_document(), _is_gost_name() (+6 more)

### Community 58 - "Community 58"
Cohesion: 0.38
Nodes (14): _auth(), _create_project(), _email(), Тикет 04 Friday RC: приглашения, project_admin, договорные поля.  Покрытие: созд, _register(), _register_manager(), _set_expired(), test_bulk_invite_limit_and_revoke() (+6 more)

### Community 59 - "Community 59"
Cohesion: 0.15
Nodes (11): a4f5945 feat(backend): таск 07 — перенос новостей и достижений на платформу: модели, миграции 0024-0026, роутеры (контракт news-types.ts), планировщик публикаций, хуки наград, nh3-санитизация; +44 теста, _main(), Каталог достижений: идемпотентный seed 66 медалей (тикет 01, спека §4.2).  Едины, Идемпотентный upsert каталога (ON CONFLICT (slug) DO UPDATE).      Возвращает ит, seed(), Санитизация HTML-контента новостей при записи (F04-11, R05; OWASP-базовая линия), Возвращает безопасный HTML: всё вне allow-list'а вырезано/экранировано., Текст без разметки (заголовки, excerpt карточек в ленте). (+3 more)

### Community 60 - "Community 60"
Cohesion: 0.29
Nodes (13): _auth(), _draft_project(), _email(), Тикет 13 Friday RC: архивирование, аудит и экспорт.  Покрытие: - Пустой черновик, Экспорт: карточка, решения заявок, документы — без закрытых данных., Пустой черновик (без опросника и документов) удаляется владельцем., Верифицированный проект нельзя удалить — только архивировать., Глобальный аудит — append-only, доступен только администратору. (+5 more)

### Community 61 - "Community 61"
Cohesion: 0.15
Nodes (8): 40b4040 fix(infra): repair backup timer and offsite wiring, 7f6ad43 fix(frontend): harden production API rewrite, contentSecurityPolicy, internalApiUrl, nextConfig, publicApiOverride, securityHeaders, FRONTEND_DIR

### Community 62 - "Community 62"
Cohesion: 0.18
Nodes (7): hash_token(), SHA-256 хеш токена для хранения в БД (отзыв без хранения JWT в открытом виде)., Подписывает атрибуцию ссылки: проект + автор + срок жизни.      Формат ``user_id, Возвращает ID автора ссылки, если подпись валидна для проекта и не истекла., _share_sig_key(), sign_share_attribution(), verify_share_attribution()

### Community 63 - "Community 63"
Cohesion: 0.24
Nodes (12): _get_redis(), is_blocked(), _key(), Троттлинг неудачных логинов (R05.5, защита от брутфорса).  Скользящее окно на па, Сброс состояния (тесты)., Ленивый Redis-клиент для fixed window; None если REDIS_URL пуст/недоступен., Источник запроса для лимита.      Приоритет: X-Real-IP — его ставит наш nginx из, record_failure() (+4 more)

### Community 64 - "Community 64"
Cohesion: 0.28
Nodes (11): _auth(), Refresh-цикл: пара токенов, ротация, отзыв при повторном использовании., R15: выход убивает refresh; access доживает до истечения (принятый компромисс)., R15: после смены пароля все прежние сессии мертвы для обновления токена., _register(), test_login_returns_refresh_token(), test_logout_is_idempotent_and_safe_on_unknown_token(), test_logout_revokes_current_pair() (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.49
Nodes (12): _auth(), _email(), _published(), Тикет 09 Friday RC: комментарии заявок, PDF-заключение, очистка версий.  Покрыти, _register(), test_cleanup_forbidden_for_plain_member(), test_cleanup_removes_old_versions_but_protects_snapshots(), test_comments_closed_after_approval() (+4 more)

### Community 66 - "Community 66"
Cohesion: 0.27
Nodes (11): _auth(), _email(), _mock_llm_ok(), _mock_scanner(), _promote_to(), Тикет 22 Friday RC: black-box E2E — один проект последовательно УГТ 1→9.  Провод, Один проект последовательно УГТ 1→9 (тикет 22, black-box E2E)., Проводит проект с текущего уровня до target через заявки N→N+1. (+3 more)

### Community 67 - "Community 67"
Cohesion: 0.46
Nodes (11): _auth(), _create_project_with_members(), _email(), _register(), test_active_member_can_read_project(), test_cntr_manager_sees_any_project(), test_executors_catalog_public(), test_outsider_gets_404_not_403() (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.44
Nodes (12): JoinDecisionIn, JoinIn, JoinRequestOut, JoinResultOut, MemberPriorityIn, Заявка на вступление (или участник) для очереди модерации., RegenerateTokenOut, ShareSigOut (+4 more)

### Community 69 - "Community 69"
Cohesion: 0.17
Nodes (6): metadata, STATUS_LABELS, containerVariants, easeOut, heroVariants, itemVariants

### Community 70 - "Community 70"
Cohesion: 0.45
Nodes (11): _auth(), _create_project_with_data(), Генерация документов: резолв переменных (включая бюджет ТЭО), сохранение в реест, Паспорт с незаполненными уровнями не должен оставлять {{...}}., _register(), _seed_tz_template(), test_generate_by_outsider_404(), test_generate_invalid_doc_type() (+3 more)

### Community 71 - "Community 71"
Cohesion: 0.35
Nodes (11): _add_audit(), decide_join_request(), _is_priority_member(), join_project(), list_join_requests(), _project_out(), regenerate_token(), require_priority_access() (+3 more)

### Community 72 - "Community 72"
Cohesion: 0.24
Nodes (10): formatAxisValue(), KEYWORD_RULES, ProjectRadar(), ProjectRadarDoc, ProjectRadarProps, RADAR_CATEGORIES, radarAxisValues(), RadarCategory (+2 more)

### Community 73 - "Community 73"
Cohesion: 0.22
Nodes (6): pluralCriteria(), UGT_PHASES, UGT_STRIP_SHORT_NAMES, UGTBadge(), UGTLevelCard(), ugtTone()

### Community 74 - "Community 74"
Cohesion: 0.20
Nodes (9): CATEGORIES, levelOptions(), ProjectSummary, RegistryTab, STATUS_BADGE, STATUS_LABELS, TechnologiesPage(), Technology (+1 more)

### Community 75 - "Community 75"
Cohesion: 0.25
Nodes (10): _email(), _published_project(), Глобальный лимит тела запроса (R05.5/R16): oversize → 413 на любом пути., R16: запрос без Content-Length (chunked) не обходит лимит., Минимальный путь до published-проекта (как в test_requirement_sets)., R16: stage-document-file использует общий лимитированный читатель., test_chunked_oversize_rejected_without_content_length(), test_normal_body_passes_through() (+2 more)

### Community 76 - "Community 76"
Cohesion: 0.36
Nodes (9): _auth(), AI-ассистент: OpenAI-совместимый клиент, fallback, источники из RAG., RAG-поиск выполняется один раз на запрос (без дублирования)., _register(), _seed_rag_doc(), test_chat_fallback_shows_rag_sources(), test_chat_fallback_without_rag_docs(), test_chat_rag_search_runs_once() (+1 more)

### Community 77 - "Community 77"
Cohesion: 0.38
Nodes (10): _current_stage(), _evaluate(), _latest_request(), _next_version(), stage_evaluate(), _stage_reqs_with_status(), stage_requirements(), _trigger_application() (+2 more)

### Community 78 - "Community 78"
Cohesion: 0.24
Nodes (8): _clean_tables(), _create_test_db(), Pytest configuration: isolated test database (technozrelost_test).  IMPORTANT: e, Create the test database if it does not exist (idempotent)., Ensure the test DB exists and is migrated once per session., Truncate mutable data after every test so tests are independent.      Uses sync, _run_migrations(), _test_database()

### Community 79 - "Community 79"
Cohesion: 0.29
Nodes (9): _python_slugs(), Дрейф каталога медалей: два носителя — seed_achievents.py и 0025_*.sql.  Оба ист, Slug'и _CATALOG из seed_achievements.py через ast.literal_eval., Slug'и из VALUES-строк INSERT в 0025_achievements.sql (regex)., Каждый носитель по отдельности содержит эталонные 66 медалей., Порядок и состав slug'ов совпадают между носителями (и slug=icon_key в SQL)., _sql_slugs(), test_catalog_sources_have_spec_count_and_boundaries() (+1 more)

### Community 80 - "Community 80"
Cohesion: 0.31
Nodes (7): Smoke tests: auth round-trip against the isolated test database., test_cntr_staff_role_cannot_be_self_registered(), test_duplicate_email_conflict(), test_login_wrong_password_rejected(), test_register_login_me_roundtrip(), test_unknown_role_rejected(), _unique_email()

### Community 81 - "Community 81"
Cohesion: 0.47
Nodes (9): _auth(), Профиль (редактирование, смена пароля) и администрирование пользователей., _register(), test_admin_unknown_role_rejected(), test_admin_updates_roles_and_deactivates(), test_change_password(), test_list_users_requires_admin(), test_login_with_new_password() (+1 more)

### Community 82 - "Community 82"
Cohesion: 0.49
Nodes (8): _auth(), _register(), _sample_results(), test_create_project_returns_token_and_201(), test_create_project_without_questionnaire_current_level_zero(), test_creator_is_priority_member(), test_new_project_visible_in_own_list_and_detail(), test_target_level_validation()

### Community 83 - "Community 83"
Cohesion: 0.42
Nodes (9): accept_invite(), create_invite(), _invite_out(), list_invites(), _membership(), require_project_admin(), revoke_invite(), transfer_project_admin() (+1 more)

### Community 84 - "Community 84"
Cohesion: 0.28
Nodes (7): compute_readiness(), _evidence_score(), EvidenceRequirement, Versioned project-readiness questionnaire and server-side scoring.  The source q, Calculate a conservative, continuous preliminary assessment.      The result is, ReadinessCheckpoint, _round_pct()

### Community 85 - "Community 85"
Cohesion: 0.50
Nodes (8): _email(), _login(), Защита от брутфорса: лимит неудачных логинов с одного источника (R05.5)., test_failed_logins_are_rate_limited(), test_rate_limit_counts_forwarded_ips_separately(), test_rate_limit_is_scoped_per_account(), test_x_real_ip_wins_over_forwarded_for(), test_xff_spoof_rotation_does_not_bypass()

### Community 86 - "Community 86"
Cohesion: 0.58
Nodes (8): _auth(), _create_project(), Контрольные точки: авто-создание при проекте, решения эксперта/аудитора., _register(), test_auditor_go_no_go_on_kt1(), test_expert_can_decide_control_point(), test_project_creation_seeds_control_points(), test_regular_user_cannot_decide_control_point()

### Community 87 - "Community 87"
Cohesion: 0.33
Nodes (8): _count_statements(), _create_project(), Таск 06: карточка проекта после устранения N+1 по верифицирующим документам.  По, n пользователей-загрузчиков и по документу от каждого (напрямую в БД)., GET карточки не должен обрасти запросами на каждый документ (N+1).      Гард: у, _seed_uploaders_with_docs(), test_detail_query_count_bounded(), test_detail_returns_uploader_names()

### Community 88 - "Community 88"
Cohesion: 0.28
Nodes (5): _FakeUpload, Хардненинг загрузки файлов: обрыв чтения сверх лимита до записи в хранилище., Заглушка UploadFile: отдаёт данные порциями, как Starlette., test_read_limited_passes_file_under_limit(), test_read_limited_stops_at_max_bytes()

### Community 89 - "Community 89"
Cohesion: 0.36
Nodes (8): decide_draft(), decide_promotion(), _draft_row(), notify_managers(), promotion_history(), _promotion_out(), queue_drafts(), queue_promotions()

### Community 90 - "Community 90"
Cohesion: 0.39
Nodes (8): add_comment(), cleanup_old_versions(), _comment_out(), download_conclusion(), _is_staff(), list_comments(), list_project_requests(), _require_request_access()

### Community 91 - "Community 91"
Cohesion: 0.25
Nodes (3): jetbrainsMono, manrope, metadata

### Community 92 - "Community 92"
Cohesion: 0.29
Nodes (5): get_current_user_optional(), has_role(), is_cntr_staff(), Токен опционален: публичные эндпоинты (реестры) работают без авторизации., True, если у пользователя есть хотя бы одна из ролей (или он суперпользователь).

### Community 93 - "Community 93"
Cohesion: 0.46
Nodes (7): _check_production_guard(), demo_projects(), main(), reset_database(), seed_all(), seed_projects(), seed_users()

### Community 94 - "Community 94"
Cohesion: 0.61
Nodes (7): public.audit_trail, public.control_points, public.project_documents, public.project_members, public.projects, public.questionnaire_results, public.users

### Community 95 - "Community 95"
Cohesion: 0.39
Nodes (5): _answer(), test_new_assessment_calculates_and_persists_readiness_result(), test_not_applicable_is_excluded_from_project_fill_rate(), test_readiness_keeps_ugt_continuous_and_reports_dimension_scores(), test_verified_evidence_increases_confidence()

### Community 96 - "Community 96"
Cohesion: 0.54
Nodes (7): _auth(), _email(), Fail-closed антивирус: скачивание разрешено только clean-файлам (R05.3)., _set_scan_status(), test_download_allowed_for_clean(), test_download_blocked_when_scan_error(), _upload_doc()

### Community 97 - "Community 97"
Cohesion: 0.50
Nodes (7): _issue_tokens(), login(), logout(), me(), refresh(), register(), _user_out()

### Community 98 - "Community 98"
Cohesion: 0.33
Nodes (5): _engine_kwargs(), get_read_db(), pool_options(), Размер пула из настроек (таск 06); NullPool эти ключи не принимает., Read-сессия (тикет 18): Replica, если задана DATABASE_REPLICA_URL.      Только д

### Community 99 - "Community 99"
Cohesion: 0.52
Nodes (6): public.notifications, public.projects, public.promotion_requests, public.stage_requirements, public.users, public.verification_documents

### Community 100 - "Community 100"
Cohesion: 0.52
Nodes (6): public.news_categories, public.news_post_media, public.news_post_tags, public.news_posts, public.news_tags, public.users

### Community 101 - "Community 101"
Cohesion: 0.29
Nodes (6): ApiUser, { handlers, signIn, signOut, auth }, JWT, LoginResponse, Session, User

### Community 102 - "Community 102"
Cohesion: 0.29
Nodes (1): Санитизация HTML новостей на записи: stored XSS исключён (F04-11, F03-02).  Конт

### Community 103 - "Community 103"
Cohesion: 0.38
Nodes (6): _connect(), Таск 06 (производительность): горячие пути реестров.  Шов — реальные миграции: c, Каждый индекс из миграции 0027 существует в БД после upgrade head., Одиночный ix_news_posts_status (0024) поглощён префиксом композита     (status,, test_absorbed_news_status_index_dropped(), test_hot_path_indexes_exist()

### Community 104 - "Community 104"
Cohesion: 0.48
Nodes (6): assessment_template(), create_assessment(), _draft_out(), _ensure_template(), my_assessments(), _readiness_from_model()

### Community 105 - "Community 105"
Cohesion: 0.48
Nodes (5): _doc_out(), list_project_files(), _next_version(), rescan_project_file(), upload_project_file()

### Community 106 - "Community 106"
Cohesion: 0.33
Nodes (3): Executor, ROLE_COLORS, ROLE_NAMES

### Community 107 - "Community 107"
Cohesion: 0.60
Nodes (5): public.permissions, public.role_permissions, public.roles, public.user_roles, public.users

### Community 108 - "Community 108"
Cohesion: 0.67
Nodes (5): public.assessment_answers, public.assessment_checkpoints, public.assessment_templates, public.project_assessments, public.projects

### Community 109 - "Community 109"
Cohesion: 0.67
Nodes (5): public.achievements, public.project_achievements, public.projects, public.user_achievements, public.users

### Community 110 - "Community 110"
Cohesion: 0.40
Nodes (5): _assign_staff_role(), priority_share_sig(), Test-only account provisioning helpers.  Central staff roles are not self-regist, Серверная подпись атрибуции ссылки (N-01): легитимная замена shared_by из тела., register_test_user()

### Community 111 - "Community 111"
Cohesion: 0.60
Nodes (5): _auth(), Полный демо-маршрут (спека §3.1) одним прогоном: регистрация → проект → опросник, _register(), _seed_tz_template(), test_full_demo_journey()

### Community 112 - "Community 112"
Cohesion: 0.33
Nodes (1): Юнит-тесты чанкера ГОСТов.

### Community 113 - "Community 113"
Cohesion: 0.53
Nodes (4): _card_out(), get_nioktr_card(), get_organization(), list_nioktr_cards()

### Community 114 - "Community 114"
Cohesion: 0.70
Nodes (4): main(), mark_migration_backup_done(), marker_written_after_start(), migration_backup_already_done()

### Community 115 - "Community 115"
Cohesion: 0.50
Nodes (4): build_conclusion_pdf(), PDF-заключение менеджера по рассмотренной заявке (тикет 09).  Генерация валидног, Строит PDF-заключение по рассмотренной заявке (approved/rejected)., _register_font()

### Community 116 - "Community 116"
Cohesion: 0.80
Nodes (4): public.organization_members, public.user_organizations, public.user_profiles, public.users

### Community 117 - "Community 117"
Cohesion: 0.60
Nodes (3): check_databases(), _check_engine(), ready()

### Community 118 - "Community 118"
Cohesion: 0.60
Nodes (4): mark_read(), my_notifications(), _out(), In-app уведомления (тикет 22): лента для текущего пользователя.

### Community 119 - "Community 119"
Cohesion: 0.50
Nodes (3): init schemas + pgvector  Revision ID: 0001 Revises: Create Date: 2026-07-21 12:0, _sql(), upgrade()

### Community 120 - "Community 120"
Cohesion: 0.50
Nodes (3): rag_documents table (pgvector, Hash/B-Tree indexes)  Revision ID: 0002 Revises:, _sql(), upgrade()

### Community 121 - "Community 121"
Cohesion: 0.50
Nodes (3): rbac: roles, users, user_roles, permissions, role_permissions  Revision ID: 0003, _sql(), upgrade()

### Community 122 - "Community 122"
Cohesion: 0.50
Nodes (3): projects, questionnaire_results, project_members, control_points, project_docume, _sql(), upgrade()

### Community 123 - "Community 123"
Cohesion: 0.50
Nodes (3): rag_metadata: add template_metadata JSONB to rag_documents  Revision ID: 0005 Re, _sql(), upgrade()

### Community 124 - "Community 124"
Cohesion: 0.50
Nodes (3): organizations_technologies: реестры организаций и технологий (НИОКТР)  Revision, _sql(), upgrade()

### Community 125 - "Community 125"
Cohesion: 0.50
Nodes (3): audit_project_nullable: аудит действий вне проекта  Revision ID: 0008 Revises: 0, _sql(), upgrade()

### Community 126 - "Community 126"
Cohesion: 0.50
Nodes (3): control_point_decision_width: расширение поля решения КТ  Revision ID: 0009 Revi, _sql(), upgrade()

### Community 127 - "Community 127"
Cohesion: 0.50
Nodes (3): new_core: словарь этапов, заявки на повышение, верифицирующие документы, уведомл, _sql(), upgrade()

### Community 128 - "Community 128"
Cohesion: 0.50
Nodes (3): readiness_assessment: versioned 22-checkpoint assessment model  Revision ID: 001, _sql(), upgrade()

### Community 129 - "Community 129"
Cohesion: 0.50
Nodes (3): fix_gost_mojibake: correct mojibake GOST titles/source_uri  Revision ID: 0012 Re, _sql(), upgrade()

### Community 130 - "Community 130"
Cohesion: 0.50
Nodes (3): dedup_promotion_requests: partial unique index on active requests  Revision ID:, _sql(), upgrade()

### Community 131 - "Community 131"
Cohesion: 0.50
Nodes (3): nioktr_cards: registry of NIOKTR cards  Revision ID: 0014 Revises: 0013 Create D, _sql(), upgrade()

### Community 132 - "Community 132"
Cohesion: 0.50
Nodes (3): profiles_organizations: user profiles, user organizations, membership  Revision, _sql(), upgrade()

### Community 133 - "Community 133"
Cohesion: 0.50
Nodes (3): project_invites_admin: project_admin flag, legal fields, invites  Revision ID: 0, _sql(), upgrade()

### Community 134 - "Community 134"
Cohesion: 0.50
Nodes (3): file_storage: document file metadata (MinIO + ClamAV)  Revision ID: 0018 Revises, _sql(), upgrade()

### Community 135 - "Community 135"
Cohesion: 0.50
Nodes (3): requirement_sets: request document snapshot, template version  Revision ID: 0019, _sql(), upgrade()

### Community 136 - "Community 136"
Cohesion: 0.50
Nodes (3): request_comments: comments on promotion requests  Revision ID: 0020 Revises: 001, _sql(), upgrade()

### Community 137 - "Community 137"
Cohesion: 0.50
Nodes (3): publication_consent: project publish consent  Revision ID: 0021 Revises: 0020 Cr, _sql(), upgrade()

### Community 138 - "Community 138"
Cohesion: 0.50
Nodes (3): nioktr_source: source and import date for external records  Revision ID: 0022 Re, _sql(), upgrade()

### Community 139 - "Community 139"
Cohesion: 0.50
Nodes (3): notification_outbox: outbox for realtime delivery and task claims  Revision ID:, _sql(), upgrade()

### Community 140 - "Community 140"
Cohesion: 0.50
Nodes (3): news: news_posts / news_categories / news_tags / news_post_tags / news_post_medi, _sql(), upgrade()

### Community 141 - "Community 141"
Cohesion: 0.50
Nodes (3): achievements: каталог достижений (66 медалей)  Revision ID: 0025 Revises: 0024 C, _sql(), upgrade()

### Community 142 - "Community 142"
Cohesion: 0.50
Nodes (3): achievement_awards: user_achievements / project_achievements  Revision ID: 0026, _sql(), upgrade()

### Community 143 - "Community 143"
Cohesion: 0.50
Nodes (3): performance_indexes: индексы горячих путей реестров (таск 06)  Revision ID: 0027, _sql(), upgrade()

### Community 144 - "Community 144"
Cohesion: 0.83
Nodes (3): embed_text(), embed_texts(), tokenize()

### Community 145 - "Community 145"
Cohesion: 0.83
Nodes (3): public.project_invites, public.projects, public.users

### Community 146 - "Community 146"
Cohesion: 0.83
Nodes (3): public.project_documents, public.promotion_request_documents, public.promotion_requests

### Community 147 - "Community 147"
Cohesion: 0.83
Nodes (3): public.promotion_requests, public.request_comments, public.users

### Community 148 - "Community 148"
Cohesion: 0.83
Nodes (3): public.notification_outbox, public.notifications, public.users

### Community 149 - "Community 149"
Cohesion: 0.67
Nodes (3): metrics_endpoint(), _queue_pending_count(), Prometheus-эндпоинт GET /api/v1/metrics (тикет 20).  Собирает счётчики из app.se

### Community 151 - "Community 151"
Cohesion: 0.67
Nodes (1): COLORS

### Community 152 - "Community 152"
Cohesion: 0.67
Nodes (1): AXIS_ITEMS

### Community 153 - "Community 153"
Cohesion: 1.00
Nodes (2): public.organizations, public.technologies

### Community 154 - "Community 154"
Cohesion: 1.00
Nodes (2): public.nioktr_cards, public.organizations

### Community 155 - "Community 155"
Cohesion: 0.67
Nodes (1): Базовые security-заголовки на каждом ответе API (R05, OWASP-базовая линия).

## Knowledge Gaps
- **441 isolated node(s):** `Снимок внутрь страницы. Возвращает текст для отчёта.`, `Наш ли это процесс. Узкая проверка намеренно: широкая уже убивала чужое.`, `Прежний порт, если свободен, иначе любой. Стабильный адрес важнее случайного.`, `Закрывает этапы, которые прогон уже прошёл. Возвращает список закрытых.      Инв`, `Молчит, пока состояние сходится само с собой. Не чинит: называет.      Ловит оди` (+436 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 102`** (1 nodes): `Санитизация HTML новостей на записи: stored XSS исключён (F04-11, F03-02).  Конт`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 112`** (1 nodes): `Юнит-тесты чанкера ГОСТов.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 151`** (1 nodes): `COLORS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 152`** (1 nodes): `AXIS_ITEMS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 153`** (2 nodes): `public.organizations`, `public.technologies`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 154`** (2 nodes): `public.nioktr_cards`, `public.organizations`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 155`** (1 nodes): `Базовые security-заголовки на каждом ответе API (R05, OWASP-базовая линия).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Project` connect `Community 16` to `Community 22`, `Community 9`, `Community 11`, `Community 8`, `Community 30`, `Community 2`, `Community 68`, `Community 21`, `Community 31`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `User` connect `Community 16` to `Community 92`, `Community 22`, `Community 9`, `Community 19`, `Community 8`, `Community 31`, `Community 2`, `Community 68`, `Community 3`, `Community 21`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `Settings` connect `Community 15` to `Community 36`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 91 inferred relationships involving `User` (e.g. with `Токен опционален: публичные эндпоинты (реестры) работают без авторизации.` and `True, если у пользователя есть хотя бы одна из ролей (или он суперпользователь).`) actually correct?**
  _`User` has 91 INFERRED edges - model-reasoned connections that need verification._
- **Are the 87 inferred relationships involving `Project` (e.g. with `Повторяемая демо-среда: полный сброс и сидирование демо-БД (тикет 19).  Использо` and `TRUNCATE всех таблиц приложения (кроме справочников и служебных).`) actually correct?**
  _`Project` has 87 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Снимок внутрь страницы. Возвращает текст для отчёта.`, `Наш ли это процесс. Узкая проверка намеренно: широкая уже убивала чужое.`, `Прежний порт, если свободен, иначе любой. Стабильный адрес важнее случайного.` to the rest of the system?**
  _441 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02908496732026144 - nodes in this community are weakly interconnected._