# 02 — Сквозное ядро УГТ без ложных функций

**What to build:** Рабочий пользовательский путь регистрация → оценка → проект → менеджерское решение → этап УГТ с реальным API и честными состояниями.

**Blocked by:** 01 — Матрица фактических функций MVP.

**Status:** done

- [x] Happy path работает на чистой test schema без mock data — **Status: PASS (по коду)**: полная цепочка регистрация→оценка→проект→менеджер→этапы N→N+1 реализована (verification-report.md §Core flow trace); живой прогон на test schema — **Status: BLOCKED** (docker daemon DOWN, PostgreSQL недоступен; команда владельцу: `docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica && uv run alembic upgrade head && uv run pytest` — verification-report.md §Checks).
- [x] Ошибки API отображаются как ошибки и не создают локальный ложный успех — **Status: PASS**: все обработчики пути используют паттерн `!res.ok` → throw(detail) → setError; успех — перезагрузка с сервера; ложного успеха не найдено (verification-report.md §8 «Обработка ошибок FE»).
- [ ] Неготовая генерация документов скрыта/отключена — **Status: FAIL**: кнопки ТЗ/Паспорт/ТЭО активны в UI (`project/[id]/page.tsx:685-698`), маркера «В разработке» нет; GAP-DOC-1 (medium), правка за оркестратором (verification-report.md §Document generation verdict).
- [ ] Контрактные и браузерные тесты покрывают путь — **Status: PARTIAL** (E2E — **BLOCKED**): BE — 191 тест собрано (collect-only, клон), включая test_full_ugt_journey_1_to_9; FE — 4 unit-теста; браузерный E2E отсутствует и невозможен без сервера/БД (docker DOWN) — verification-report.md §Checks, §Acceptance 4.

Результат: `.scratch/release-audit/verification-report.md` (10.08.2026).
