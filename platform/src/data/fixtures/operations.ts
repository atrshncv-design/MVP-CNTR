/**
 * T-004. Контролируемые UI-фикстуры операционных задач Центра.
 *
 * НАЗНАЧЕНИЕ: проверка очередей операционного центра (STATES.md §1):
 * action_required / under_review / clarification / approval / blocked / closed,
 * приоритеты, типы задач, объекты.
 *
 * ПРАВИЛА: isFixture: true + label «Тестовый пример для проверки интерфейса»;
 * очередь — авторизованная область (операционный центр), в публичные методы
 * фикстуры не попадают.
 */

import {
  fixtureMarker,
  type OperationalTask,
  type Priority,
  type Status,
} from "../../lib/types.ts";

const fixture = fixtureMarker();

const task = (
  id: string,
  objectType: OperationalTask["objectType"],
  objectId: string,
  objectTitle: string,
  taskType: OperationalTask["taskType"],
  priority: Priority,
  status: Status,
  lastEvent: string,
  nextAction: string,
  extra: Partial<OperationalTask> = {},
): OperationalTask => ({
  id,
  objectType,
  objectId,
  objectTitle,
  taskType,
  priority,
  status,
  assignee: "Тестовый сотрудник Центра",
  dueDate: null,
  missingEvidenceSummary: null,
  lastEvent,
  nextAction,
  createdAt: "2026-08-05T08:00:00.000Z",
  updatedAt: "2026-08-05T08:00:00.000Z",
  ...extra,
  ...fixture,
});

export const operationalTaskFixtures: OperationalTask[] = [
  task(
    "fixture-task-verify-01",
    "technology",
    "fixture-tech-review-02",
    "Тестовая технология: композитный материал для машиностроения",
    "verify",
    "high",
    "action_required",
    "Подана заявка на верификацию УГТ 3",
    "Проверить комплект свидетельств и вынести решение",
    { dueDate: "2026-08-12" },
  ),
  task(
    "fixture-task-clarification-02",
    "technology",
    "fixture-tech-clarification-03",
    "Тестовая технология: датчик контроля вибрации",
    "clarification",
    "medium",
    "clarification",
    "Запрошены уточнения по свидетельствам",
    "Дождаться ответа участника и проверить дополнения",
  ),
  task(
    "fixture-task-review-03",
    "request",
    "fixture-request-review-02",
    "Тестовый запрос: автоматизация учёта на производстве",
    "review",
    "medium",
    "under_review",
    "Запрос заказчика поступил в Центр",
    "Проверить корректность и подобрать исполнителей",
  ),
  task(
    "fixture-task-decision-04",
    "technology",
    "fixture-tech-approved-04",
    "Тестовая технология: цифровой двойник производственной линии",
    "decision",
    "high",
    "approval",
    "Верификация пройдена, решение на согласовании",
    "Завершить согласование и подготовить публикацию",
  ),
  task(
    "fixture-task-publication-05",
    "technology",
    "fixture-tech-published-06",
    "Тестовая технология: энергоэффективная система освещения",
    "publication",
    "low",
    "blocked",
    "Публикация отложена: ожидается подтверждение данных",
    "Устранить блокер и опубликовать запись",
  ),
  task(
    "fixture-task-recheck-06",
    "organization",
    "fixture-org-executor-1",
    "Тестовая организация",
    "recheck",
    "low",
    "closed",
    "Проверка реквизитов завершена",
    "—",
    { missingEvidenceSummary: null },
  ),
  task(
    "fixture-task-onboarding-07",
    "research",
    "fixture-research-1",
    "Тестовая научная публикация",
    "onboarding",
    "low",
    "draft",
    "Заявка научной организации на добавление публикации",
    "Проверить метаданные и принять в реестр",
  ),
];

export const operationalTasksById: ReadonlyMap<string, OperationalTask> =
  new Map(operationalTaskFixtures.map((t) => [t.id, t]));
