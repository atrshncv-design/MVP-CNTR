/**
 * T-010. Операционный контур Центра: словари и хелперы очереди.
 *
 * Общие подписи и правила приоритизации для страниц операционного центра
 * (ROLES.md §«Operations dashboard priority»): просроченное → требующие
 * решения → недостающие доказательства → новые записи → кандидаты на
 * публикацию. Все счётчики строятся ТОЛЬКО из переданных данных —
 * модуль не содержит фикстур и не фабрикует значения.
 */

import {
  PRIORITY_LABELS,
  type OperationalTask,
  type OperationalTaskObjectType,
  type OperationalTaskType,
  type Priority,
  type Status,
} from "./types.ts";

export { PRIORITY_LABELS };

/** Русские подписи типов операционных задач. */
export const TASK_TYPE_LABELS: Record<OperationalTaskType, string> = {
  verify: "Проверка свидетельств",
  review: "Рассмотрение запроса",
  clarification: "Уточнение данных",
  decision: "Принятие решения",
  publication: "Подготовка публикации",
  recheck: "Перепроверка",
  onboarding: "Приём в реестр",
};

/** Русские подписи типов объектов очереди. */
export const OBJECT_TYPE_LABELS: Record<OperationalTaskObjectType, string> = {
  technology: "Технология",
  request: "Запрос",
  organization: "Организация",
  research: "НИОКТР",
  pilot: "Пилот",
};

/** Русские подписи приоритетов (синоним PRIORITY_LABELS для удобства). */
export const PRIORITY_ORDER: readonly Priority[] = [
  "urgent",
  "high",
  "medium",
  "low",
];

/** Статусы, в которых задача считается «открытой» (требует действия). */
export const OPEN_STATUSES: readonly Status[] = [
  "draft",
  "action_required",
  "under_review",
  "clarification",
  "approval",
  "blocked",
  "active",
];

/** Статусы, в которых объект считается закрытым (срок не «горит»). */
const FINAL_STATUSES: readonly Status[] = [
  "approved",
  "published",
  "closed",
  "archived",
];

/**
 * Просрочена ли задача: есть срок, срок раньше today, объект не в финальном
 * статусе. Сравнение по календарной дате (YYYY-MM-DD).
 */
export function isOverdueTask(task: OperationalTask, today: string): boolean {
  if (!task.dueDate) return false;
  if (FINAL_STATUSES.includes(task.status)) return false;
  return task.dueDate < today;
}

/** Задача требует действия сотрудника Центра. */
export function needsAction(task: OperationalTask): boolean {
  return (
    task.status === "action_required" ||
    task.status === "under_review" ||
    task.status === "approval" ||
    task.status === "blocked"
  );
}

/** У задачи есть незакрытые недостающие доказательства/уточнения. */
export function hasMissingEvidence(task: OperationalTask): boolean {
  return Boolean(task.missingEvidenceSummary);
}

/** Кандидат на публикацию: тип задачи «publication» или статус «approved». */
export function isPublicationCandidate(task: OperationalTask): boolean {
  return task.taskType === "publication" || task.status === "approved";
}

/** Задача создана/изменена недавно (новые записи). */
export function isRecentlyChanged(
  task: OperationalTask,
  now: Date,
  windowDays = 7,
): boolean {
  const windowStart = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const createdAt = new Date(task.createdAt).getTime();
  const updatedAt = new Date(task.updatedAt).getTime();
  if (Number.isNaN(createdAt) && Number.isNaN(updatedAt)) return false;
  return Math.max(createdAt, updatedAt) >= windowStart;
}

/**
 * Маршрут объекта очереди внутри операционного центра.
 * Технология → проверочное досье; запрос → карточка модерации; остальные
 * объекты → соответствующий реестр (у организаций/НИОКТР/пилотов нет
 * операционных карточек в P0, реестр — честная цель).
 */
export function objectHref(
  objectType: OperationalTaskObjectType,
  objectId: string,
): string {
  const id = encodeURIComponent(objectId);
  switch (objectType) {
    case "technology":
      return `/operations/technology/${id}`;
    case "request":
      return `/operations/requests/${id}`;
    case "organization":
      return "/operations/organizations";
    case "research":
      return "/operations/research";
    case "pilot":
      return "/operations/pilots";
  }
}

/** Свежесть очереди: максимальный updatedAt задач (или null, если пусто). */
export function queueUpdatedAt(tasks: readonly OperationalTask[]): string | null {
  if (tasks.length === 0) return null;
  let max = "";
  for (const task of tasks) {
    if (task.updatedAt && task.updatedAt > max) max = task.updatedAt;
  }
  return max || null;
}

/**
 * Приоритизация для раздела «центр» (ROLES.md): возвращает группы задач в
 * порядке важности. Задача может входить в несколько групп — группы не
 * вычитаются, каждая отвечает на свой вопрос дашборда.
 */
export interface QueueGroups {
  overdue: OperationalTask[];
  needDecision: OperationalTask[];
  missingEvidence: OperationalTask[];
  recent: OperationalTask[];
  publicationCandidates: OperationalTask[];
}

export function groupQueue(
  tasks: readonly OperationalTask[],
  now: Date,
): QueueGroups {
  const today = now.toISOString().slice(0, 10);
  return {
    overdue: tasks.filter((t) => isOverdueTask(t, today)),
    needDecision: tasks.filter((t) => needsAction(t)),
    missingEvidence: tasks.filter((t) => hasMissingEvidence(t)),
    recent: tasks.filter((t) => isRecentlyChanged(t, now)),
    publicationCandidates: tasks.filter((t) => isPublicationCandidate(t)),
  };
}
