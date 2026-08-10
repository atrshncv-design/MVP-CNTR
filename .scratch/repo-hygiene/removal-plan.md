# Removal plan — тикет 03 «Удаление подтверждённого мусора и усиление ignore»

**Тикет:** `.scratch/repo-hygiene/issues/03-remove-junk.md`
**Worktree:** `$REPO/.worktrees/repo-hygiene-complete-v2`, ветка `codex/repo-hygiene-complete-v2`, HEAD `a01a27b`
**Дата:** 10.08.2026
**Источник данных:** `.scratch/repo-hygiene/inventory-report.md` (тикет 01, done) + повторная read-only проверка в этом запуске.

Правила запуска: удаление — ТОЛЬКО внутри `$WT` и только untracked/ignored; старый worktree `repo-hygiene-inventory` — по процедуре группы 2; чужие worktree — read-only; никаких git add/commit/push/merge, сборок и установок.

**Статусы кандидатов:** `retained` — не удаляется и не перемещается в этом цикле (может использоваться); `archive-pending` — ожидает авторизованного переноса в `docs/archive`; `deletion-pending` — ожидает согласования оркестратора/владельца и внешнего бэкапа ДО удаления. Для ценных материалов дополнительно: **approval required** — письменное одобрение Functional Validator/оркестратора; **backup gate** — обязательная внешняя копия на отдельном носителе до любых действий. Ни один кандидат со статусом, отличным от удалённого/`deletion-pending` после одобрения, в этом запуске не удалялся.

## Группа 1 — Разрешено удалить без дополнительного вопроса (только пересоздаваемые артефакты)

### 1.1 Внутри $WT (мой worktree)

Поиск `find . -name '.DS_Store' -o -name '*.log' -o -name '__pycache__' -o -name '.pytest_cache' -o -name '*.tsbuildinfo' -o -name 'node_modules' -o -name '.next' -o -name '.venv'` в `$WT` (без `node_modules/.next/.venv` в корне) → **результат: пусто (0 совпадений)**. `git status --porcelain --ignored` в `$WT` → ни одного `!!`-файла. **Вывод: в корневом дереве $WT пересоздаваемого мусора нет — удалять нечего.** Не игнорируемые untracked-файлы в `$WT` (README.md, docs/canonical-layout.md, .scratch/repo-hygiene/*) — это артефакты тикетов 01–02, НЕ мусор, не удаляются.

### 1.2 Артефакты в ЧУЖИХ worktree — НЕ удалять (требуется согласование оркестратора)

| Путь (worktree) | Размер | Tracked / статус | Команда восстановления | Статус кандидата | Пометка |
|---|---|---|---|---|---|
| `technozrelost-frontend/node_modules/` | 556M | нет tracked (0 в ls-files); ignored (`!!`) в своём worktree | `cd technozrelost-frontend && npm ci` | deletion-pending | удаление в другом worktree — требуется согласование оркестратора |
| `technozrelost-frontend/.next/` | 1.2G | нет tracked; ignored (`!!`) | `cd technozrelost-frontend && npm run build` | deletion-pending | то же |
| `technozrelost-frontend/tsconfig.tsbuildinfo` | 156K | нет tracked; ignored (`!!`) | пересоздаётся `npx tsc --noEmit` | deletion-pending | то же |
| `technozrelost-backend/.venv/` | 280M | нет tracked; ignored (`!!`) | `cd technozrelost-backend && uv sync --all-extras` | deletion-pending | то же |
| `technozrelost-backend/.pytest_cache/` | 32K | нет tracked; ignored (`!!`, покрыт backend/.gitignore стр. 8) | пересоздаётся `uv run pytest` | deletion-pending | то же |
| `.worktrees/new-front/platform/` (вкл. node_modules внутри) | 660M | 94 tracked-файла `platform/` в ветке `new-front` (см. группа 3) | из ветки `new-front` (origin/new-front) | deletion-pending | то же |
| `$REPO/.DS_Store` (корень REPO = корневой worktree) | ~8K | нет tracked | пересоздаётся macOS | deletion-pending | корневой worktree — read-only, не удалять |
| `$REPO/.od-skills/` (корень REPO) | 128 байт, 2 подкаталога (`agent-browser-ff76ddd73c/`, `web-prototype-4ab6e4cb5f/`) | нет tracked; ignored | n/a (не артефакт сборки) | retained | НЕ пуст (гипотеза rules.md «пуст» не подтвердилась); другой worktree — не удалять, задокументировано |

## Группа 2 — Можно удалить только после обратимой проверки

| Путь | Ветка / HEAD | Размер | Проверка перед удалением (результат в этом запуске) | Статус кандидата | Решение |
|---|---|---|---|---|---|
| `.worktrees/repo-hygiene-inventory/` | `codex/repo-hygiene-inventory`, HEAD `c2964a2` | 14M | ✅ `git worktree list` — путь существует; ✅ `git -C … status --porcelain` — **ПУСТ (чистый)**; ✅ ветка существует (`codex/repo-hygiene-inventory`), HEAD `c2964a2`; восстановление: `git worktree add -b codex/repo-hygiene-inventory <путь> c2964a2` | **deleted** — выполнено 10.08.2026 (`git worktree remove` БЕЗ `--force`; ветка сохранена) | санкционировано брифом тикета 03; ветку НЕ удалять |
| `.worktrees/front-dorabotka/` | `front-dorabotka`, c2964a2 | 14M | владелец не установлен; может использоваться другими сессиями | **retained** | НЕ удалять — требуется решение оркестратора |
| `.worktrees/mvp-10-140826/` | `MVP-10-140826`, c2964a2 | 14M | то же | **retained** | НЕ удалять — требуется решение оркестратора |
| `.worktrees/repo-hygiene-inventory-v2/` | `codex/repo-hygiene-inventory-v2`, a01a27b | 14M | worktree предыдущей v2-попытки тикета 01; в брифе не санкционирован | **retained** | НЕ удалять — требуется решение оркестратора |

## Группа 3 — Нельзя удалять в этом запуске (только записи)

| Путь | Размер | Tracked | Статус кандидата | Approval required / Backup gate | Владелец / решение | Риск |
|---|---|---|---|---|---|---|
| `ГОСТЫ/` (корень REPO) | 70M | нет (untracked, ignored) | **retained** | **approval required:** письменное одобрение Functional Validator; **backup gate:** внешняя копия на отдельном носителе ДО любых действий | не установлен; решение — оркестратор + Functional Validator, отдельный тикет | **высокий** — уникальные RAG-исходники (docx: положение о центре НТР УР, паспорт №364, «Трансфер технологий»), в git не были |
| `Данные для тестового реестра/` (корень REPO) | 395M | нет (untracked, ignored) | **retained** | **approval required:** Functional Validator; **backup gate:** внешняя копия + сверка полноты с seed `data/nioktr_all.json` | не установлен; решение — оркестратор + Functional Validator | **средний** — дубль seed (16 582 карточки), полнота не сверена |
| `КОД MVP "0" 210726 - ТОЛЬКО ФРОНТЭНД/` (в корне) | 11M | да (в ветках c2964a2; в корневом дереве частично удалён — 127 D) | **archive-pending** | **approval required:** авторизованный тикет оркестратора на перенос в `docs/archive`; **backup gate:** полное восстановление из git | не установлен (исторический артефакт, импортирован 21.07) | низкий (уже в git) |
| `.worktrees/new-front/platform/` | 660M (вкл. node_modules) | да (94 файла в ветке `new-front`) | **deletion-pending** | **approval required:** подтверждение владельца ветки + оркестратор; **backup gate:** `origin/new-front` | не установлен; ветка активна; решение — оркестратор + Functional Validator (ручной гейт) | средний — конкурирующее дерево frontend, дубль канонического |
| Ветка `new-front` | — | — | **retained** | **approval required:** отдельный ручной гейт оркестратора (удаление веток вне scope); **backup gate:** origin | оркестратор | низкий |
| Архивы: `friday-release-candidate/` (12M, docs, tracked), `.worktrees/new-front/` (прочее, 15M), `new-front/` в корне (5 md-документов, 80K, untracked) | см. столбец | см. столбец | **retained** (`archive-pending` для `friday-release-candidate/` при желании) | **approval required:** оркестратор; **backup gate:** `friday-release-candidate` — из git; `new-front/` (корень) — untracked, НЕ восстановим → внешняя копия | не установлен; документы-справочники | низкий |
| Любые tracked-файлы с исходным кодом (frontend/backend/legacy/docs/.scratch) | — | да | **retained** | approval не требуется (в этом цикле не удаляются); backup: из git | — | — |
| Любые данные без внешней копии | — | — | **retained** | **approval required:** Functional Validator; **backup gate:** создать внешнюю копию ДО любых действий | — | — |

## Итог материальных удалений в этом запуске

1. Внутри `$WT` — **ничего** (мусор не найден; см. 1.1).
2. `.worktrees/repo-hygiene-inventory/` — удаляется по процедуре группы 2 (чистый, без `--force`, ветка `codex/repo-hygiene-inventory` сохраняется).
3. Чужие worktree — не изменялись; артефакты задокументированы в группе 1 с командами восстановления.
