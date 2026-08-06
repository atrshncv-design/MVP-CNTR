/**
 * T-010. Строка операционной задачи (плотная таблица очереди).
 *
 * Desktop-строка 56–64px (Design.md §8.3): объект со ссылкой, тип задачи,
 * приоритет, статус, ответственный, срок, недостающие доказательства,
 * последнее событие, следующее действие. Мобильная версия — стек-карточка
 * с подписями полей (в ops-queue-table).
 *
 * Компонент презентационный: не знает об источнике данных, все значения
 * приходят из OperationalTask (T-004).
 */

import Link from "next/link";
import { ArrowRight, CalendarClock, CircleAlert, UserRound } from "lucide-react";
import type { OperationalTask, Priority } from "@/lib/types";
import { formatDate } from "@/lib/datetime";
import { objectHref, OBJECT_TYPE_LABELS, TASK_TYPE_LABELS } from "@/lib/operations";
import { StatusBadge } from "@/components/status-badge";

/** Бейдж приоритета: цвет + текст (не только цвет). */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const classes: Record<Priority, string> = {
    urgent: "bg-status-danger-soft text-status-danger",
    high: "bg-status-warning-soft text-status-warning",
    medium: "bg-status-info-soft text-status-info",
    low: "bg-status-draft-soft text-status-draft",
  };
  const labels: Record<Priority, string> = {
    urgent: "Срочно",
    high: "Высокий",
    medium: "Средний",
    low: "Низкий",
  };
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-2 py-0.5 text-meta font-medium ${classes[priority]}`}
    >
      {labels[priority]}
    </span>
  );
}

/** Ссылка на объект задачи внутри операционного центра. */
export function TaskObjectLink({
  task,
  className = "",
}: {
  task: OperationalTask;
  className?: string;
}) {
  return (
    <Link
      href={objectHref(task.objectType, task.objectId)}
      className={`rounded-control font-medium text-primary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${className}`}
    >
      {task.objectTitle}
    </Link>
  );
}

/** Подпись объекта: тип + название (для мобильных карточек). */
export function ObjectTypeLabel({ type }: { type: OperationalTask["objectType"] }) {
  return (
    <span className="inline-flex items-center rounded-[6px] bg-canvas px-2 py-0.5 text-meta font-medium text-secondary">
      {OBJECT_TYPE_LABELS[type]}
    </span>
  );
}

/** Срок задачи с маркером просрочки (по календарной дате). */
export function DueDateCell({
  dueDate,
  overdue,
}: {
  dueDate: string | null;
  overdue: boolean;
}) {
  if (!dueDate) {
    return <span className="text-meta text-muted">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-meta ${
        overdue ? "font-medium text-status-danger" : "text-secondary"
      }`}
    >
      <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
      {formatDate(dueDate)}
      {overdue ? <span className="sr-only">, просрочено</span> : null}
    </span>
  );
}

/**
 * Плотная строка таблицы очереди (desktop). Одна задача = одна строка
 * ~56–64px; длинные поля обрезаются с многоточием.
 */
export function OpsTaskRow({
  task,
  today,
}: {
  task: OperationalTask;
  today: string;
}) {
  const overdue = Boolean(task.dueDate && task.dueDate < today);

  return (
    <tr className="align-top transition-colors hover:bg-surface-elevated/60">
      {/* Объект */}
      <td className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          <ObjectTypeLabel type={task.objectType} />
        </div>
        <TaskObjectLink task={task} className="mt-1 line-clamp-2 text-small" />
      </td>
      {/* Тип задачи */}
      <td className="whitespace-nowrap px-3 py-2.5 text-small text-secondary">
        {TASK_TYPE_LABELS[task.taskType]}
      </td>
      {/* Приоритет */}
      <td className="whitespace-nowrap px-3 py-2.5">
        <PriorityBadge priority={task.priority} />
      </td>
      {/* Статус */}
      <td className="whitespace-nowrap px-3 py-2.5">
        <StatusBadge status={task.status} size="sm" />
      </td>
      {/* Ответственный */}
      <td className="max-w-[160px] px-3 py-2.5">
        <span className="flex items-start gap-1.5 text-small text-secondary">
          <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          <span className="line-clamp-2">{task.assignee}</span>
        </span>
      </td>
      {/* Срок */}
      <td className="whitespace-nowrap px-3 py-2.5">
        <DueDateCell dueDate={task.dueDate} overdue={overdue} />
      </td>
      {/* Недостающее */}
      <td className="max-w-[200px] px-3 py-2.5">
        {task.missingEvidenceSummary ? (
          <span className="flex items-start gap-1.5 text-small text-status-warning">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{task.missingEvidenceSummary}</span>
          </span>
        ) : (
          <span className="text-meta text-muted">—</span>
        )}
      </td>
      {/* Последнее событие */}
      <td className="max-w-[200px] px-3 py-2.5">
        <span className="line-clamp-2 text-small text-secondary">{task.lastEvent}</span>
      </td>
      {/* Следующее действие */}
      <td className="max-w-[220px] px-3 py-2.5">
        <span className="flex items-start gap-1.5 text-small text-secondary">
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
          <span className="line-clamp-2">
            {task.nextAction === "—" ? "Задача завершена" : task.nextAction}
          </span>
        </span>
      </td>
    </tr>
  );
}
