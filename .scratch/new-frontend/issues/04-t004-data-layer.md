# T-004 — Typed data layer and real-data fixtures

Status: ready-for-agent
Blocked by: T-001 (не блокируется T-002/T-003 по файлам)

## Цель
Типизированный domain data layer + интерфейс `PlatformDataAdapter` + mock-адаптер на РЕАЛЬНЫХ данных НИОКТР. Компоненты не знают об источнике данных. Никаких выдуманных публичных записей.

## Зависимости
T-001. Фундамент для T-006…T-012.

## Изменяемые файлы / области
- `platform/src/lib/types.ts` — доменные типы: TechnologySummary, TechnologyDossier, CustomerRequest(+Summary), ResearchRecord, OrganizationSummary, OperationalTask, UgtMethodology, WorkspaceSnapshot, HomeSummary, Page<T>, ListQuery, VisibilityScope, Role, Decision, Comment, NotificationEvent, DraftInput/SubmissionInput и др. (DATA-CONTRACTS §3–4).
- `platform/src/lib/adapter/types.ts` — интерфейс `PlatformDataAdapter` (методы из DATA-CONTRACTS §3).
- `platform/src/lib/adapter/mock-adapter.ts` — реализация на фикстурах + задержка для loading-состояний + генерация ошибок по запросу (для error-состояний).
- `platform/src/lib/adapter/index.ts` — фабрика: `DATA_ADAPTER=mock|api` (по умолчанию mock); api-адаптер — стаб-скелет с теми же сигнатурами (бросает «не подключено», если env=api).
- `platform/src/data/nioktr-fixtures.json` — РЕАЛЬНЫЕ данные: копия 400 карточек из `technozrelost-backend/data/nioktr_sample.json` (источник МИНОБРНАУКИ России; provenance-поля сохраняются). Файл кладётся в `platform/src/data/` (или `public/data/` — решает реализатор, но с сохранением исходной структуры `{cards: [...]}`).
- `platform/src/data/fixtures-*.ts` — контролируемые UI-фикстуры: dossier технологий, запросы, пилоты, операционные задачи в разных статусах (STATES.md), ВСЕ с `isFixture: true` и полем `label: "Тестовый пример для проверки интерфейса"`.

## Сценарий пользователя
Публичный посетитель видит реальные записи НИОКТР (название, организация, ключевые слова, дата, источник). Разделы без реальных данных показывают честные пустые состояния. Авторизованный пользователь в dev-режиме видит помеченные фикстуры для проверки сценариев.

## Acceptance criteria
- [ ] Публичные примеры — реальные данные или честные empty-состояния (DATA-CONTRACTS §2).
- [ ] Маршрут переключается между адаптерами заменой одной строки (env), без правок компонентов.
- [ ] Пропущенные поля видны как частичные данные, не фабрикуются.
- [ ] Ни одна публичная страница не показывает `isFixture` записи.
- [ ] Источник и дата импорта видны на карточках НИОКТР (provenance).
- [ ] Адаптер умеет: успех, пустой ответ, ошибку, задержку (для скелетонов), пагинацию/фильтры по сигнатуре ListQuery.

## Состояния
loading (задержка адаптера), empty, partial, error (по триггеру), success — возвращаются как типизированные результаты.

## Desktop / mobile
Не применимо (слой данных). Проверяется через UI тикетов T-006+.

## Данные и adapter requirements
Реальные: 400 карточек НИОКТР. Фикстуры: маркированные, не публичные. Проверка: `python3 -c "import json; d=json.load(open('src/data/nioktr-fixtures.json')); print(len(d['cards']))"` → 400.

## Критерии визуальной проверки
Через T-006 (реестр НИОКТР). Здесь: юнит-тест адаптера (`node --test tests/`) — mock возвращает 400 карточек, фильтр по ключевым словам работает, фикстуры не попадают в публичные методы.
