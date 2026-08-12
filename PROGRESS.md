# PROGRESS — Внутренний UX-контур (internal-ux-redesign)

| # | Тикет | Статус |
|---|-------|--------|
| 01 | Shell и шапка | ready-for-review |
| 02 | Меню функций и навигация | ready-for-review |
| 03 | Общий layout и состояния | ready-for-review |
| 04 | Проекты и подробная карточка | ready-for-review |
| 05 | Реестры | ready-for-review |
| 06 | Кабинеты ролей | ready-for-review |
| 07 | Формы, таблицы и фильтры | ready-for-review |
| 08 | Интеграция и финальные артефакты | ready-for-review |

## Финальная проверка (12.08.2026, повторный полный прогон)

- lint **PASS** (0 errors, 8 pre-existing warnings)
- tsc **PASS** (clean)
- build **PASS** (success, 25 маршрутов)
- git diff --check **PASS**
- npm test **PARTIAL** — 15/17; 2 fail = **baseline-дефекты** (theme-logic: нет `src/lib/theme.ts` в c4f0794; login: нет бренд-строк в approved-дизайне). Доказано прогоном на pristine baseline (7/9, те же 2 fail). Регрессии тикетов 01–08 нет (все 8 новых тестов pass)
- Browser QA (:3001, headless Chrome+CDP, реальный логин) — 16/16 PASS: логин, шапка, «Больше функций» (open/Escape/focus), breadcrumb (aria-current), sidebar collapse (aria-expanded), ProjectsExplorer, реестры (технологии 9 / НИОКТР 20 / организации 20), табличный режим (tabindex-скролл), skip-link, responsive 320/768/1440 (без overflow, бургер)
- CORS :3001 — PASS (live `access-control-allow-origin: http://localhost:3001`; `CORS_ORIGINS` в dev-`.env`, без секретов, вне git)
- FAIL/BLOCKED — нет; PARTIAL: npm test (baseline), скринридер (нет инструмента)

Артефакты: `.scratch/internal-ux-redesign/verification-report.md`, `acceptance-summary.md`.
Commit/push/deploy не выполнялись (HEAD = c4f0794). Остановлено в ready-for-review.
