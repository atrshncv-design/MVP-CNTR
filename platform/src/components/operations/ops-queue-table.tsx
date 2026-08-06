/**
 * T-010. Плотная таблица операционной очереди (Desktop.md §8.3).
 *
 * Desktop: таблица 56–64px со всеми колонками задачи; Mobile: стек-карточки
 * с подписями полей — статус и срок над сгибом, решение доступно без hover
 * (тикет T-010 «Desktop / mobile»). Каждая строка/карточка ведёт к объекту
 * и следующему действию.
 *
 * Презентационный компонент: данные — OperationalTask[] из адаптера;
 * пустое состояние рендерит вызывающий код (страница), таблица честно
 * не выводит счётчиков.
 */

import type { OperationalTask } from "@/lib/types";
import { formatDate } from "@/lib/datetime";
import {
  DueDateCell,
  ObjectTypeLabel,
  OpsTaskRow,
  PriorityBadge,
  TaskObjectLink,
} from "./ops-task-row";
import { StatusBadge } from "@/components/status-badge";
import { TASK_TYPE_LABELS } from "@/lib/operations";

export interface OpsQueueTableProps {
  /** Задачи текущей страницы очереди. */
  tasks: readonly OperationalTask[];
  /** Календарная дата «сегодня» (YYYY-MM-DD) для маркера просрочки. */
  today: string;
  /** Подпись таблицы для скринридеров. */
  caption?: string;
}

export function OpsQueueTable({
  tasks,
  today,
  caption = "Очередь операционных задач Центра",
}: OpsQueueTableProps) {
  if (tasks.length === 0) return null;

  return (
    <>
      {/* Desktop: плотная таблица */}
      <div className="hidden overflow-x-auto rounded-panel border border-subtle bg-surface md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-subtle bg-canvas/60 text-meta uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-2.5 font-medium">
                Объект
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Тип задачи
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Приоритет
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Статус
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Ответственный
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Срок
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Недостающее
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Последнее событие
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Следующее действие
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {tasks.map((task) => (
              <OpsTaskRow key={task.id} task={task} today={today} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: стек-карточки с подписями полей */}
      <ul className="space-y-3 md:hidden">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="rounded-panel border border-subtle bg-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ObjectTypeLabel type={task.objectType} />
              <StatusBadge status={task.status} size="sm" />
            </div>
            <TaskObjectLink task={task} className="mt-2 block text-body" />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted">
              <PriorityBadge priority={task.priority} />
              <span>{TASK_TYPE_LABELS[task.taskType]}</span>
              <span className="inline-flex items-center gap-1">
                <DueDateCell
                  dueDate={task.dueDate}
                  overdue={Boolean(task.dueDate && task.dueDate < today)}
                />
              </span>
            </div>
            <dl className="mt-3 space-y-1.5 text-small leading-relaxed">
              <div className="flex gap-2">
                <dt className="w-36 shrink-0 text-meta text-muted">
                  Ответственный
                </dt>
                <dd className="min-w-0 text-secondary">{task.assignee}</dd>
              </div>
              {task.missingEvidenceSummary ? (
                <div className="flex gap-2">
                  <dt className="w-36 shrink-0 text-meta text-muted">
                    Недостающее
                  </dt>
                  <dd className="min-w-0 text-status-warning">
                    {task.missingEvidenceSummary}
                  </dd>
                </div>
              ) : null}
              <div className="flex gap-2">
                <dt className="w-36 shrink-0 text-meta text-muted">
                  Последнее событие
                </dt>
                <dd className="min-w-0 text-secondary">{task.lastEvent}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-36 shrink-0 text-meta text-muted">
                  Следующее действие
                </dt>
                <dd className="min-w-0 text-secondary">
                  {task.nextAction === "—" ? "Задача завершена" : task.nextAction}
                </dd>
              </div>
            </dl>
            {task.dueDate ? (
              <p className="mt-3 text-meta text-muted">
                Срок: {formatDate(task.dueDate)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
