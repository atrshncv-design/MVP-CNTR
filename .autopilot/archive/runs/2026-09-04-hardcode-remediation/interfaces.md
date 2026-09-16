# Границы и правила прогона `hardcode-remediation`

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `dictionaries` | ключи обеих локалей, паритет | `t(неймспейс.ключ[, параметры]) -> строка` | файлы словарей, fallback-цепочку |
| `screens/project` | экраны проектного контура | экраны без литералов | какие ключи за каким текстом |
| `screens/registry` | реестр, фильтры, экспорт | таблица и файл без литералов | то же |
| `screens/dashboard` | дашборд и общие панели | панели без литералов | то же |
| `screens/misc` | лендинг, регистрация, контентные данные | страницы и справочники без литералов | то же |

## Ключевая конвенция (общая для всех тасков)

- Ключ: `<неймспейс>.<раздел>.<имя>`, неймспейсы: `ugt`, `showcase`, `taxonomy`, `project`, `registry`, `dashboard`, `landing`, `auth`, `common`.
- Живой словарь — `technozrelost-frontend/src/messages/ru.json` + `en.json`; зеркало — `technozrelost-frontend/messages/ru.json` + `en.json`. Каждый новый ключ вносится в ОБА файла обеих локалей одинаковым значением.
- Протокол общего ресурса: только добавление ключей в свой неймспейс; чужие ключи не переименовывать, не удалять. Волны последовательные — коллизий нет.
- Подстановки — только параметрами перевода, никакой склейки строк в коде.

## Общие правила проекта

- Стек: Next.js + next-intl (локаль из cookie, default RU). Рабочая папка фронта: `technozrelost-frontend/`.
- Команды (из `technozrelost-frontend/`): `npm run lint`, `npm test`. Финальная проверка таска 06: + `npm run build`.
- Не трогать: `technozrelost-backend/` целиком; списки ключевых слов обезличивания и логи (`sanitize`-тип, `[matching]`/`[docs-consult]`); сиды; конфиги/адреса (P1 — следующий заход).
- EN-тексты пишет исполнитель (решение брифинга); спорные формулировки методологии — списком в контракт-блоке.
- Если не хватает зависимости — не ставить, вернуть `BLOCKED: <имя>` с причиной.
- Один таск — один коммит, поверх чекпоинта `e690b29`.

## Из таска 01 — фундамент и контент

- `TranslateFn (call+raw)`, `asTranslateFn(t)`, `translatorFor(ns, locale)`, `contentMessages(locale)`, `shimLocale/shimList` — из `src/lib/translators.ts`
- Контент через резолверы: `getUgtLevels/getUgtLevel/.../UGT_IDS/UGT_COLORS` (`t`, scope `ugt`); `getShowcaseProjects/getShowcaseCategories/...` (scope `showcase`); `getProjectTags/getTagLabel/validateTagsT/categoryToTags`, `PROJECT_TAGS/TAG_SLUGS` (scope `taxonomy`)
- Шимы на удаление тасками 02–05 (текущая локаль, RU-default нет): `UGT_LEVELS/UGP/UGI/UGS_LEVELS/ROADMAP_TRANSITIONS` (02–05: project/landing), `SHOWCASE_PROJECTS/SHOWCASE_CATEGORIES` (05), `validateTags` (02)
- `protocol.json` — locale-free каноника RU-значений (данные бэкенда); полный состав сверяется со словарём тестом
- Тесты: `npm test`, один файл — `node --test tests/<файл>`

## Из таска 02 — проектный контур

- `projectTranslator()`, `getReturnBadgeT(t,…)`, `downloadTemplate(req, token?, t?)`, `useAutosave{leaveMessage?}`, `dateTimeLocale(locale)` — из `src/features/project/i18n.ts` (делегирует фабрике 01)
- Неймспейс `project` (141 ключ); паритет project × обе пары — тест `tests/i18n.test.mjs`
- Шим `validateTags` живёт до T06 (требует тест 01); бюджет — формат ru-RU принят как есть

## Из таска 03 — реестр и экспорт

- `registryTranslator()` (делегирует фабрике 01); `getProject/Organization/NioktrHeaders(t)`, `describeFiltersT(t, f)`; заголовки XLSX/листов/статусы через `t(registry.*)`
- Неймспейс `registry` (144 ключа); остаток сканера зоны — только логи и бренд-метаданные (не трогать)
- EN-решения сборки: `ЦНТР→CNTR`, `УГТ→TRL`, `НИОКТР→R&D` (EN ревьюит пользователь на приёмке)

## Из таска 04 — дашборд и UI-кит

- `dashboardTranslator()` (делегирует фабрике 01); хелперы radarAxisLabel/radarAria/getNewsStatusLabel/getScanLabel/getAchievementGroupLabel/getJoinRoles/formatSizeT/achieveCountT; `dateTimeLocale` — в `src/features/project/i18n.ts`
- Неймспейс `dashboard` (236 ключей, вкл. `ui*` UI-кита и `uiUgtBadge`); мёртвая карта executors удалена
- Остаток сканера зоны — только стемы KEYWORD_RULES радара, бренд layout, regex-FP (не трогать)

## Из таска 05 — лендинг и остаток

- `landingTranslator/authTranslator/commonTranslator` + `slavicPluralKind`, `roadmapDuration-Stages-Tasks-Results`, `formatSizeT`, `getJoinRoleOptions(9)`, `llmErrorText/llmReasonText` + 5 llm-сентинел-кодов, `kpiKindForLabel`, `isFallbackReason` — из `src/features/misc/i18n.ts` (делегируют фабрике 01)
- Неймспейсы `landing`/`auth`/`common` (+21 мета-ключ); метаданные 11 страниц через словарь, URL без изменений
- Шимы `UGT_*/ROADMAP_TRANSITIONS/SHOWCASE_*` УДАЛЕНЫ, потребители на резолверах
- Добор T06: удалить шим `validateTags` + обновить тест 01 (`tests/content-dictionaries.test.mjs:138`); RU `formatRuDate/formatRelative/getStatusLabel(lib)`; осиротевший экспорт `shimList`; третий `formatSizeT` в misc — свести к общему

## Из таска 06 — финальная сверка

- T-варианты везде: `getStatusLabelT/formatRelativeT/formatDateLocale`; старые RU-экспорты (`formatRuDate/formatRuDateTime/STATUS_LABELS/validateTags/shimList`) удалены, висячих импортов нет
- Сканер: ui-string 83 (только запрещёнка: стемы 48, логи/LLM, бренд, test-пин, P1-конфиги, FP), паритет 0 (2605/2605)
- Сюита 150/150, lint/tsc/build зелёные; 2 API-ошибки (ExportButton/news-admin-api) — в R04, следующий заход

## Из таска 07 — добор слепой приёмки

- Ключи `common.aiDocDocsOnly`, `registry.exportError`, `news.admin.requestError`; лог ExportButton — плоским литералом, сообщение — через `t()` в role=alert
- Мёртвый label пароля в auth.config удалён (вход кастомный); `wb.creator` — бренд, не трогать
- Сиротский `DOCS_ONLY_REPLY` в sanitize — мелкий долг запретного файла
- Сканер: ui-string 73 (только запрещёнка), паритет 0 (2608/2608); сюита 151/151

## Швы (проверка только здесь)

1. Сканер аудита: `python3 .autopilot/2026-09-04-hardcode-audit/scan.py <out>` — строки экрана вне словарей → 0, паритет ключей → 0 расхождений.
2. Зелёная сюита фронта: `npm run lint`, `npm test`.
