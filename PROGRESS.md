# PROGRESS — security-remediation-audit (13.08.2026)

Release baseline (доказан по аудиту c2964a2):
- Backend: физический каталог `technozrelost-backend/` = содержимое subdir снапшота `release/friday-rc` @ `9e6cccc` (миграции 0001–0023, единственный head `0023`)
- Frontend: физический каталог `technozrelost-frontend/` = ветка `codex/frontend-design-baseline-2026-08-11` @ `c4f0794`
- Docs/тикеты: корневой worktree @ `c2964a2` (`.scratch/security-remediation-audit/`)
- Блокер: БД `technozrelost_test`/`technozrelost` намигрированы до `0038` (следы ветки `codex/release-integration`); канон = `0023`

1. 01-release-baseline-and-migrations — **done**
2. 02-auth-rbac-and-control-point-authorization — **done**
3. 03-secrets-and-token-lifecycle — **done**
4. 04-file-quarantine-and-storage-safety — **done**
5. 05-sse-identity-and-realtime — **done**
6. 06-input-bounds-rate-limits-and-races — **done**
7. 07-production-hardening-and-privacy — **done**
8. 08-quality-gates-and-release-ci — **done**

**ИТОГ (13.08.2026): все 8 тикетов security-remediation-audit — done.**
Backend head миграций `0026`, тестовая БД на `0026` (прод/дев `technozrelost`
осталась на `0038` — приведение за владельцем). Quality gates зелёные:
pytest **278 passed**, ruff clean, mypy Success (53 files), npm test **8/8**,
npm lint 0 errors, npm build exit 0, compose config valid (fail-fast без env),
security_check ALL CHECKS PASS. CI: `.github/workflows/ci.yml` (backend +
frontend + secret-scan шаг). Commit/push не выполнялись — ждут решения
владельца.

---

## News + Achievements (news-achievements, 14.08.2026)

Спека: `.scratch/news-achievements/spec.md` · Каталог 66 медалей: `.scratch/news-achievements/catalog-66.md`

1. 01-achievements-catalog (каталог 66 + seed, backend) — **done** (`fccc668`)
2. 02-awards-engine (механика наградчиков, backend) — **done** (`4324f61`)
3. 03-achievements-showcase (витрина, backend+frontend) — **done** (`d39dd10` BE / `5e60b51` FE)
4. 04-medal-icons (66 ручных SVG-иконок, frontend) — **done** (`0ed98ed`)
5. 05-news-model-api (новости: модель+API, backend) — **done** (`98c54d6`)
6. 06-news-schedule-notify (отложенная публикация+уведомления, backend) — **done** (`1ab0c68`)
7. 07-news-public (публичный раздел /news, frontend) — **done** (`d81b01b`)
8. 08-news-admin-console (консоль ЛК + редактор, frontend) — **done** (`03e5366` BE / `4ce9a37` FE)
9. 09-achievements-analytics (админ-аналитика, backend+frontend) — **done** (`c89ebb7` BE / `a05e6a6` FE)

**ИТОГ (14.08.2026): все 9 тикетов news-achievements — done.** Backend: миграции 0027–0029, полный pytest **317 passed**; frontend: 20/20 тестов, lint 0 errors, build/tsc зелёные. Осталось: браузерный QA в трёх темах.

## Архив: Реестр НИОКТР (nioktr-registry)

1. Компактные данные НИОКТР в репозиторий — **done**
2. Модель nioktr_cards + миграция 0014 — **done** (цепочка 0011→0014, индекс 0013 создан, mojibake 0)
3. API реестра НИОКТР и организаций — **done**
4. Seed: импорт 16 582 карточек — **done** (16582/1762, идемпотентно, API live OK)
5. Frontend: реестр НИОКТР (список + карточка) — **done**
6. Frontend: каталог организаций — **done**
7. Тесты + gates + пуш — **done** (backend 93 passed, ruff clean; frontend lint/tsc/build clean; browser QA обе темы)
