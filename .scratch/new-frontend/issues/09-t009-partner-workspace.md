# T-009 — Industrial partner workspace (кабинет исполнителя)

Status: ready-for-agent
Blocked by: T-003 (shell), T-004 (адаптер+фикстуры dossier), T-005 (состояния), T-007 (dossier-компоненты)

## Цель
Кабинет исполнителя: создать/заявить dossier технологии, описать решение, приложить доказательства, пройти checkpoint'ы, подать на проверку, ответить на уточнения, N→N+1, участвовать в запросах/пилотах. Приоритет дашборда по ROLES.md: текущий путь и следующий checkpoint → требующие действия → заявки/запросы → пилоты → документы.

## Зависимости
T-003, T-004, T-005, T-007.

## Изменяемые файлы / области
- `platform/src/app/(app)/partner/page.tsx` — дашборд исполнителя.
- `platform/src/app/(app)/partner/technologies/page.tsx`, `technologies/new/page.tsx` (создание: прогрессивное раскрытие, черновик, требования к доказательствам ДО длинной формы), `technologies/[id]/page.tsx` (рабочий dossier — T-007), `technologies/[id]/evidence/page.tsx` (доказательства и документы, upload-состояния), `technologies/[id]/path/page.tsx` (УГТ-путь, T-011).
- `platform/src/app/(app)/partner/applications/page.tsx`, `requests/page.tsx` (просмотр запросов заказчиков), `pilots/page.tsx`.
- `platform/src/components/partner/` — `technology-submit-form.tsx`, `evidence-upload.tsx` (STATES.md §6), `clarification-response.tsx`, `path-progress.tsx` (тонкая, полная — T-011).

## Сценарий пользователя
Исполнитель начинает «Представить технологию» → создаёт dossier → сохраняет черновик и возвращается → прикладывает доказательства (состояния загрузки честные) → подаёт на проверку → получает «Нужны уточнения» → отвечает → видит решение и статус публикации → проходит следующий checkpoint.

## Acceptance criteria
- [ ] Черновик сохраняется и восстанавливается; field-level валидация.
- [ ] Статус подачи и следующее действие ясны; видно, почему публикация/переход заблокирован.
- [ ] Evidence-upload: все состояния STATES.md §6; «принято» только после завершения (mock) валидации.
- [ ] Ответ на уточнение с требованием причины (отклонение/уточнение не бывают без причины).
- [ ] N→N+1: подготовка/проверка/одобрение — отдельно от «текущего уровня».
- [ ] Заявки на запросы/пилоты: entry + статусы.

## Состояния
draft, under_review, clarification, approved, rejected (с причиной), published, active, blocked, archived; загрузка документов; permission.

## Desktop / mobile
Desktop: dossier + панель доказательств. Mobile: следующий checkpoint и недостающее — над сгибом; upload доступен; таблицы → стек.

## Данные и adapter requirements
`saveDraft`, `submitForReview`, `addComment`, `getTechnology(id, scope)` — фикстуры isFixture (полный набор статусов); реальные НИОКТР как «связанные исследования» только по реальным связям.

## Критерии визуальной проверки
Браузер: сценарий «создать → черновик → доказательства → подать → уточнение → ответ → решение»; блокировка без причины; 3 темы; mobile; скриншоты. lint/tsc/build зелёные.
