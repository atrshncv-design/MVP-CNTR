# Verification Report — Внутренний UX-контур (internal-ux-redesign)

> Worktree: `.worktrees/internal-ux-redesign` · Ветка: `codex/internal-ux-redesign` (от baseline `c4f0794`)
> Дата: 12.08.2026 (финальная повторная проверка) · Интеграционный порт: **localhost:3001** (baseline :3000 не тронут)

## 1. Итоговый вердикт по проверкам

| Проверка | Результат |
|---|---|
| `npm run lint` | ✅ **PASS** — 0 errors, 8 warnings (пре-существующие, `src/components/landing/*`) |
| `npx tsc --noEmit` | ✅ **PASS** — clean |
| `npm test` | ✅ **PARTIAL** — 15/17 pass; 2 fail — **классифицированы как baseline-дефекты** (см. §2) |
| `npm run build` | ✅ **PASS** — success (42 стр., 25 маршрутов) |
| `git diff --check` | ✅ **PASS** — чисто |
| Browser QA (:3001) | ✅ **PASS** — 15/16 проверок; 1 PARTIAL→PASS (см. §5) |
| CORS integration :3001 | ✅ **PASS** — `access-control-allow-origin: http://localhost:3001` (live) |
| Secrets/env | ✅ **PASS** — `.env`/`.env.local` не отслеживаются git |

## 2. Разбор двух непройденных тестов (15/17) — **baseline-дефекты, НЕ регрессия**

Подтверждено прогоном на чистом baseline `c4f0794` (worktree `technozrelost-frontend`): **7/9 pass, те же 2 fail** — оба теста падают на pristine-снапшоте без наших изменений.

### 2.1 `tests/theme-logic.test.mjs` — **BASELINE**
- **Точное имя:** файл-тест `theme-logic.test.mjs` (содержит 4 субтеста темы).
- **Причина:** импортирует `src/lib/theme.ts`, который **отсутствует** — сам снапшот `c4f0794` удалил этот файл (`git show c4f0794 --stat`: `src/lib/theme.ts | 50 -`, вместе с `theme-toggle.tsx`), т.к. approved-дизайн перешёл на строго светлую тему без переключателя. Тест написан в `08511a1` (тикет 17/22), а в `c4f0794` его источник удалён.
- **Ошибка:** `ERR_MODULE_NOT_FOUND: Cannot find module '.../src/lib/theme.ts'`.
- **Классификация:** baseline-дефект. Файлы тикетов 01–08 этот модуль не создают (тема не в скоупе UX-контура).
- **Статус:** **PARTIAL** (тест не проходит на baseline; для зелёного CI нужен отдельный тикет: удалить/переписать тест темы или вернуть `theme.ts`).

### 2.2 `login exposes the approved product identity and explicit form states` — **BASELINE**
- **Точное имя:** `login exposes the approved product identity and explicit form states` (в `tests/ui-shell.test.mjs`).
- **Причина:** тест ожидает строки `ТЕХНОЗРЕЛОСТЬ` и `ГОСТ Р 58048-2017` в `src/app/login/page.tsx`; в approved-дизайне (`c4f0794`) их **нет** (grep: 0 вхождений). Тест написан против более ранней версии login-страницы; снапшот её переработал.
- **Проверка на регрессию:** единственная правка login тикетами 01–08 — стиль error-state (тикет 07, +9 строк), бренд-строки не добавлялись и не удалялись; на baseline тест падает идентично.
- **Классификация:** baseline-дефект. **Статус:** **PARTIAL** (для зелёного CI — отдельный тикет: добавить бренд-строку в login или ослабить тест).

**Вывод по п.1:** gate `npm test` помечен **PARTIAL, не зелёным** — 15/17 с двумя задокументированными baseline-падениями; регрессии тикетов 01–08 **нет** (все 8 новых тестов тикетов — pass: ok 8–17).

## 3. CORS для integration :3001

- **Переменная:** `CORS_ORIGINS` (backend, `technozrelost-backend/.env`, dev-окружение; в коде дефолт `app/core/config.py:38`).
- **Значение-плейсхолдер:** `http://localhost:3000,http://localhost:3001,<prod-origin>` — реальные origin'ы без секретов.
- **Live-проверка:** `GET /api/v1/health` с `Origin: http://localhost:3001` → `access-control-allow-origin: http://localhost:3001` + `allow-credentials: true` (200 OK).
- **Secrets:** не добавлялись; `CORS_ORIGINS` не содержит токенов/ключей.
- **Git:** `.env` (backend) и `.env.local` (frontend) — в `.gitignore`, `git ls-files` пусто, `git status` по ним пуст. **НЕ коммитятся.**
- **Для прод/staging:** добавить реальный origin фронтенда в `CORS_ORIGINS` при деплое (открытый риск R-3).

## 4. Статус тикетов (без изменений)

| Тикет | Статус | Приёмка |
|---|---|---|
| 01 Shell и шапка | ready-for-review | PASS |
| 02 Меню функций и навигация | ready-for-review | PASS |
| 03 Общий layout и состояния | ready-for-review | PASS |
| 04 Проекты и подробная карточка | ready-for-review | PASS |
| 05 Реестры | ready-for-review | PASS |
| 06 Кабинеты ролей | ready-for-review | PASS |
| 07 Формы, таблицы и фильтры | ready-for-review | PASS |
| 08 Интеграция и финальные артефакты | ready-for-review | PASS |

## 5. Browser QA — финальный прогон (headless Chrome + CDP, :3001, реальный логин)

| # | Проверка | Результат |
|---|---|---|
| 1 | LOGIN → /dashboard/gk_customer | ✅ PASS |
| 2 | Шапка (логотип, Рабочий стол, Проекты, Заявки, профиль) | ✅ PASS |
| 3 | Breadcrumb (`aria-label="Хлебные крошки"`, `aria-current="page"`) | ✅ PASS |
| 4 | Кнопка «Больше функций» (`aria-expanded=false`) | ✅ PASS |
| 5 | Кнопка сайдбара «Навигация по разделу» (`aria-expanded=false`) | ✅ PASS |
| 6 | Overflow 1440px (scrollW==clientW) | ✅ PASS |
| 7 | Dropdown открытие (6 карточек) | ✅ PASS |
| 8 | Dropdown закрытие Escape + возврат фокуса на кнопку | ✅ PASS |
| 9 | Sidebar collapse (aria-expanded → true, inert-тело) | ✅ PASS |
| 10 | ProjectsExplorer (Карточки/Таблица + поиск + 3 селекта) | ✅ PASS |
| 11 | Реестр технологий (9 карточек, переключатель, поиск) | ✅ PASS |
| 12 | Реестр НИОКТР (20 карточек) | ✅ PASS |
| 13 | Реестр организаций (20 карточек) | ✅ PASS |
| 14 | Skip-link `#main-content` | ✅ PASS |
| 15 | Таблица: `table` + колонки + `tabindex=0` скролл-контейнер (технологии, режим ?view=table) | ✅ PASS (ранее PARTIAL — закрыт) |
| 16 | Responsive 320px (без overflow, бургер) | ✅ PASS |
| 17 | Responsive 768px (без overflow, бургер) | ✅ PASS |

**Keyboard/focus/ARIA:** dropdown — клик/вне/Escape + возврат фокуса (проверено); skip-link; `aria-current` в навигации/breadcrumb; `aria-expanded/controls/haspopup` в dropdown/сайдбаре; `aria-invalid/describedby` и `role="alert"` в полях (код, тикет 07); touch targets ≥40px (globals.css). Скринридер-прогон — недоступен (нет инструмента) → **PARTIAL** (открытый риск R-2).

## 6. Визуальные расхождения с baseline (c4f0794)

| Область | Baseline | Теперь |
|---|---|---|
| Шапка | 8 пунктов в ряд | логотип + 3 пункта + «Больше функций» dropdown + уведомления + профиль-аватар + выход |
| Ширина | 1280px | 1440px |
| Breadcrumb | отсутствовал | обязательный, с aria-current |
| Списки | grid-карточки | таблица/карточки + поиск/фильтры/сортировка/пагинация/сохранение |
| Карточки списков | радар в карточке | компактные, без радаров |
| Карточка проекта | радар в шапке, дубли | радар только в aside; блоки по спеке |
| Кабинеты ролей | разнородные | единый паттерн «данные/действия/следующий шаг» |
| Поля форм | разрозненные | ui/fields с error/aria |

## 7. Инциденты и ремонт (история)

1. Повреждение кода субагентом 07 (`Authorization: *** ` вместо `` `Bearer `` в 14 файлах) — исправлено в 27 местах; гейты зелёные. *(Внимание: при чтении через инструменты Hermes `Authorization: *** ` маскируется в выводе — проверка повреждений ведётся по hex/grep на диске.)*
2. CORS :3001 добавлен в dev-`.env` backend (не в git), backend перезапущен.
3. ProjectsExplorer при пустом списке не рендерился — исправлено (рендерится всегда; empty различает «Проектов пока нет»/«Ничего не найдено»).
4. Ложная тревога в QA: «0 организаций» — медленный эндпоинт (~7с), при увеличенном ожидании — 20 карточек (PASS).

## 8. Открытые риски

- **R-1:** 2 baseline-фейла тестов (`theme-logic`, `login`) — для `npm test` = green нужен отдельный тикет вне спекы internal-ux-redesign.
- **R-2:** скринридер-прогон и keyboard-only по всем 9 ролям — PARTIAL (одна QA-учётка, gk_customer).
- **R-3:** для прод/staging добавить origin фронтенда в `CORS_ORIGINS` (сейчас :3001 — в dev-`.env`).
- **R-4:** QA-учётка `qa-ux-internal@cntr-test.ru` (gk_customer) создана на dev-БД — не прод.

## 9. Подтверждение: commit/push/deploy НЕ выполнялись

- `git log` в worktree: HEAD = `c4f0794`; 49 изменённых файлов (37 M + 12 ??) не закоммичены.
- Команды git add/commit/push/merge/rebase/reset/deploy не запускались (проверено по транскриптам субагентов и состоянию).
- `.env`/`.env.local` — вне git.
