# Карта версий репозитория

*Составлено: 2026-08-31, прогон repo-structure-optimization (тикет 03). Актуализировано: 19 remote-веток, HEAD +30 vs main, архивные теги.*

**Актуально на 2026-08-31:**

| Ветка | HEAD | Отношение к origin/main | Статус |
|---|---|---|---|
| `origin/main` | `a7dfbf3` | — | Эталон, битый `.gitignore` (`<<<<<<< HEAD` с `babc9b9`) — fix в `autopilot/m0` `da684d4` |
| `autopilot/m0-security-hardening` (текущая) | `47cd50c` | **+30 вперёд** (M0…M4 + T01 hygiene) | **Текущая** — ведётся оптимизация структуры |
| `autopilot/deploy-readiness-code` | `6475946` | +8/-2 vs main | Держать до merge |
| `release/friday-rc` | `c89ebb7` | предок deploy-readiness | Архив |
| `codex/*` (9) + `feat/*` (2) + `new-front` | см. §2 | частично влиты | Кандидаты `archive/*` теги (локально созданы 2026-08-31) |

**Крупные файлы — кандидаты LFS (не удалять без отдельного решения, ломает клоны):**
| Файл | Размер | Использование | Решение |
|---|---|---|---|
| `technozrelost-backend/data/nioktr_all.json` | 64M | `app/db/seed_nioktr.py:28`, `reset_demo.py:46`, 16K карточек | Оставить в Git до LFS-решения (`git lfs track`) |
| `.graphify/graph.json` | 3.9M | knowledge graph, 451 файл | Оставить (portable artifact) или игнорить — по решению владельца |
| `docs/Справочник…docx` | 2.8M | контекст проекта | LFS кандидат |
| `technozrelost-frontend/public/videos/hero-bg.mp4` | 2.5M | `src/app/(landing)/page.tsx:55` | Оставить (лендинг) или CDN/LFS |

**Локальные архивные теги (2026-08-31, не пушены):** `archive/main-pre-hygiene-20260831`, `archive/autopilot-deploy-readiness-code-20260831`, `archive/release-friday-rc-20260831` (`git tag | grep archive/`)

*Составлено: 2026-08-25, прогон deploy-readiness-audit (тикет 02). Все счётчики проверены командами `git rev-list` / `git merge-base --is-ancestor` на момент составления.*

**Remote:** `origin` = https://github.com/atrshncv-design/MVP-CNTR.git
**«Правда»:** `origin/main` @ `a8f85c6` — сюда сходится всё после приёмки аудита.
Это ОДИН репозиторий с worktrees: физические папки — чекауты разных веток, не копии.

## 1. Основные линии

| Ветка | Где живёт (чекаут) | HEAD | Что держит | Отношение к origin/main | Судьба |
|---|---|---|---|---|---|
| `origin/main` | — | `a8f85c6` | Эталон: бэкенд + актуальные docs, корневой `.gitignore`, фикс rewrites фронта (`be54109`) | — | **Держать.** Цель финального merge |
| `autopilot/deploy-readiness-code` | `.worktrees/deploy-readiness` | `43a98ce` | База аудита: friday-rc `c89ebb7` + фронт `a05e6a6` (консолидация) + правки аудита | **+8 вперёд** (новости, достижения, 317 тестов; консолидация), **−2 позади** (`be54109`, `a8f85c6`) | **Держать до merge.** После приёмки — merge в main (учесть −2) |
| `release/friday-rc` | корень: `technozrelost-backend/` | `c89ebb7` | Бэкенд-линия RC | Полностью предок базы аудита | **Архив после merge.** Содержание уже в `deploy-readiness-code` |
| `codex/frontend-design-baseline-2026-08-11` | корень: `technozrelost-frontend/` | `a05e6a6` | Новейший дизайн-базелин фронта | По родству 67 уник. коммитов, но содержание перенесено в `43a98ce` | **Архив после merge.** В этих двух чекаутах идёт работа — не трогать сейчас |
| `autopilot/deploy-readiness-audit` | корень репо | `c2964a2` | Старый снимок main-линии | 0 вперёд / **3 позади** | Держать только пока не спасены незакоммиченные правки (см. §3) |

## 2. Остальные ветки (50 всего, 34 — `codex/*`)

**Уже полностью влиты в `origin/main` — кандидаты на удаление после подтверждения владельцем:**
`MVP-10-140826`, `front-dorabotka`, `main-backup-2026-08-05`, `codex/130826`,
`codex/ai-rag-complete`, `codex/identity-organizations-complete`,
`codex/internal-frontend-complete`, `codex/mvp1-release-complete`,
`codex/operations-modules-complete`, `codex/repo-hygiene-inventory`,
`codex/requests-matching-complete`, `codex/security-infrastructure-complete`,
`codex/ugt-gamification-collection`, `codex/видениепроектадо310826`.

**Невлитые (уникальные коммиты) — кандидат в архив (тег → bundle → удаление по согласованию):**

| Ветка | Уник. коммитов vs main | Примечание |
|---|---|---|
| `new-front` | 22 | дублирует папку `new-front/` в корне; устарела относительно базелина фронта |
| `codex/friday-release-candidate` | 22 | ранняя RC-линия, перекрыта `release/friday-rc` |
| `codex/recovery-backend` | 66 | волна «recovery», частично в RC |
| `codex/recovery-frontend` | 61 | то же |
| `codex/recovery-docs` | 10 | то же |
| `codex/release-integration` | 65 | эксперимент интеграции |
| `codex/internal-ux-redesign` | 63 | UX-редизайн, не принят |
| `codex/ugt-gamification-domain` | 65 | надстройка над collection (влита) |
| `feat/backend`, `feat/frontend` | 7 + 7 | ранние эксперименты |
| `codex/release-audit-complete` | 4 | черновик аудита |
| `codex/repo-hygiene-complete-v2` / `-inventory-v2` | 3 / 2 | предыдущая попытка чистки |
| `codex/week-release-planning` | 2 | план недели |
| `codex/frontend-design-baseline…` | (см. §1) | содержание влито консолидацией |

## 3. Незакоммиченные правки (не терять!)

| Где | Объём | Спасено |
|---|---|---|
| Корневой чекаут (`deploy-readiness-audit`) | 127 D / 4 M / 12 ?? — в т.ч. выведение MVP-0 и docx из индекса (чистка владельца), `AGENTS.md`, `CODE_REVIEW_2026-08-13.md`, `FULL_CODE_REVIEW_PLAN.md`, `docs/`, `new-front/`, `.github/` | Нет — переносить вручную/патчем после приёмки. **Не трогать** |
| Worktree `technozrelost-backend/` | 741 путь (591 D / 1 M / 149 ??) | Да: `.backups/worktree-backend-dirty-*.tar.gz` |
| Worktree `technozrelost-frontend/` | грязное дерево | Да: `.backups/*-frontend-*.tar.gz` |

## 4. План освобождения `.worktrees/` (≈ 9,6 ГБ, 23 чекаута)

Крупнейшие: `ugt-gamification-collection` 1,8G · `release-integration` 1,4G · `operations-modules-complete` 1,0G · `mvp1-release-complete` 1,0G · `internal-ux-redesign` 936M · `security-infrastructure-complete` 815M · `internal-frontend-complete` 755M · `new-front` 675M.

Порядок (все шаги после merge аудита в main):

1. Страховка: полный `git bundle create mvp-cntr.bundle --all` + архив неотслеживаемого (частично уже в `.backups/`).
2. `git worktree remove <путь>` для чекаутов слитых веток (перечень в §2, блок «влиты») — освободит ≈ 6–7 ГБ.
3. Для невлитых веток: `git tag archive/<имя> <имя>` и `git push origin archive/<имя>` — коммиты сохраняются в тегах; затем `git worktree remove` + `git branch -D`.
4. Удаление самих веток на origin — отдельное согласованное действие владельца (необратимое внешнее).

Ожидаемый итог: `.worktrees/` сокращается до 1–2 активных чекаутов (~0,5 ГБ), минус ~9 ГБ на диске.
