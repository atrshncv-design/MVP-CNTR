# 06 — UX/UI production report (ticket 06)

Браузерный проход public production на 1920/768/375: 13 public routes × 3
viewport + keyboard/language/mobile-menu пробы. Только read-only GET, без auth,
без submits, без mutations. Авторизованные экраны без test accounts — `UNKNOWN`
(R36), static-выводом не подменялись. Секретов в screenshots нет (сессий не
было, чувствительные кадры не сохранялись).

- Target: `https://technozrelost.atrshnjc.beget.tech/` (как есть; локальный HEAD
  `f364388` ≠ server `f06b15c` по EV-001/EV-002 — R03: выводы только о
  наблюдаемом deployed-состоянии, не о коде).
- Даты: UTC pass 2026-09-22T04:22:46Z–2026-09-22T04:25:13Z (pass-results.json started/finished), interactions 2026-09-22T04:26:04Z–2026-09-22T04:26:22Z (pass-interactions.json started/finished).
- Нагрузка: ~45 одиночных GET последовательно с паузами ≥1.5с; stop-сигнал
  (5xx/unhealthy/mutation/чувствительный вывод) не сработал — все статусы 200.
- Артефакты зоны: `run_pass.py`, `probe_interactions.py`, `pass-results.json`,
  `pass-interactions.json`, `findings.json`, `screenshots/` (41 PNG, 11МБ).
  Временные browser profiles/TMPDIR были zone-local (`.tmp-ux/`) и удалены
  после прогона; `/tmp` и внешние директории не использовались.

## In-zone evidence (source, timestamp, target, command, exit, sanitized result)

- EV-019 — browser pass: 2026-09-22T04:22:46Z–2026-09-22T04:25:13Z (pass-results.json started/finished), target выше, команда
  `python3 docs/audit/2026-09-21-production/06-ux/run_pass.py` (exit 0):
  health 200 0.71с; 39/39 страниц 200 (13 routes × viewports 1920/768/375),
  screenshots `screenshots/<slug>-<viewport>.png`, DOM-замеры в
  `pass-results.json`. Базовые пробы EV-004 переиспользованы, не продублированы.
- EV-020 — interaction probes: 2026-09-22T04:26:22Z, команда
  `probe_interactions.py` (exit 0): Tab-порядок login
  `skip→RU/EN/ZH→email→password→Войти→Подать заявку`; EN-переключение
  `lang ru→en`, title переведён, скриншот `home-en-1920.png`; mobile-меню 375
  открывается (`aria-expanded true`), скриншот `home-menu-375.png`.
- EV-021 — label probe: timestamp unavailable (no independent start/finish record exists; DOM evidence reused from EV-019 pass-results.json pages captured 2026-09-22T04:22:46Z–2026-09-22T04:25:13Z), 2 read-only GET
  (`/projects`, `/roadmap`): `/projects` — search input без label/aria (только
  placeholder), оба select обёрнуты в label; `/roadmap` — оба УГТ-select без
  программной связки с подписями «ТЕКУЩИЙ/ЦЕЛЕВОЙ УГТ» → UX-01.

## Покрытие чек-листа UX spec (доказательно или UNKNOWN)

| Пункт | Статус |
|-------|--------|
| desktop/tablet/mobile, public routes + key states | покрыто EV-019: 13 routes × 1920/768/375, все 200 |
| overlap/clipping/overflow/z-index/scroll/layout shift | покрыто: overflowX=0 везде; z-index≥1000 — 0; stuck (fixed/sticky) 1–3 (header); скриншоты без наложений/обрезаний |
| keyboard/focus | покрыто EV-020: Tab-порядок логичен, positive tabindex — 0, skip-links первые в порядке |
| labels/actions semantics | частично: login/register — все inputs labeled + required; UX-01 (low): search placeholder-only, roadmap selects без связки |
| contrast/colors/type | частично: сплошные фоны — body 17.38, кнопки ≥4.85; текст поверх hero-изображений/градиентов computed-style не меряется (артефакты 1.0–2.29) → UX-02 (recommendation: ручной аудит оверлеев) |
| language | покрыто EV-020: RU/EN/ZH-переключатель, EN переводит nav/hero/title, `lang` атрибут меняется |
| empty/loading/validation/error/forbidden | покрыто визуально: empty states (`/`, `/projects`, `/roadmap`) с CTA (dead ends нет); `/forbidden` с recovery-ссылкой; login/register — native required + labels (submit не нажимался — mutation-запрет) |
| large lists/modals/dropdowns/toasts/sticky | частично: реестр пуст в production (large lists — UNKNOWN до данных); modals/toasts в проёме не встретились (0); dropdowns (`Ещё`, selects, mobile-меню) работают; sticky header корректен |
| feedback/actions | покрыто наблюдением: CTA ведут на существующие routes; roadmap без выбора показывает guiding-empty, не ошибку |
| authorized screens (dashboard, проекты, matching, AI, файлы) | `UNKNOWN` — test accounts не созданы (R36); вход/регистрация не выполнялись |

## Findings

- `findings.json` — 2 записи (UX-01 defect low, UX-02 product_recommendation
  low) по схеме R26 + обязательные `effort`/`risk`; severity не завышены;
  дублей SEC-/DB-/CODE-нет.
- Screenshots: каждый visual finding ссылается на screenshot/viewport/URL/role/
  steps/expected; все 41 скриншоты viewport-тегированы (1920/768/375).

## UNKNOWN (честно недоступное)

1. Авторизованный runtime всех ролей (dashboard, УГТ-гейты, файлы, SSE, AI,
   matching) — до test accounts.
2. Large lists и пагинация под данными; поведение при 5xx/loading под
   нагрузкой (нагрузка запрещена).
3. Screen-reader прогон (только static label-инвентарь + Tab-порядок).
4. Ниже-сгиба lazy-секции landing в full-page склейке (артефакт захвата, не
   дефект продукта).

## Исполнение (R30/R31)

Тикет исполнен через адаптер autopilot-opencode моделью
`opencode-go/muse-spark-1.3-contributor`. Код продукта, схема БД и production
не менялись. Mutations: 0. LLM-вызовов: 0 (лимит 200 не тронут).
ПДн/секретов/бизнес-строк в артефактах нет.
