/**
 * T-010. Вид очереди с переключателем «Таблица / Канбан».
 *
 * Канбан — ОПЦИОНАЛЬНЫЙ дополнительный вид (тикет T-010): основным остаётся
 * плотная таблица (ops-queue-table). Переключение — локальное состояние,
 * данные приходят пропсами из серверной страницы (очередь по-прежнему
 * приоритизирована в таблице).
 *
 * Колонки канбана — по статусам STATES.md §1: «Требуют действия» (открытые
 * статусы), «Одобрено / опубликовано», «Завершено». Каждая карточка ведёт
 * к объекту и следующему действию.
 */

"use client";

import { useState } from "react";
import { KanbanSquare, LayoutList } from "lucide-react";
import type { OperationalTask, Status } from "@/lib/types";
import { OpsQueueTable } from "./ops-queue-table";
import {
  DueDateCell,
  ObjectTypeLabel,
  PriorityBadge,
  TaskObjectLink,
} from "./ops-task-row";
import { StatusBadge } from "@/components/status-badge";
import { TASK_TYPE_LABELS } from "@/lib/operations";

type ViewMode = "table" | "kanban";

interface KanbanColumn {
  id: string;
  title: string;
  statuses: readonly Status[];
}

/** Колонки канбана: открытые задачи → одобренные/опубликованные → закрытые. */
const KANBAN_COLUMNS: readonly KanbanColumn[] = [
  {
    id: "action",
    title: "Требуют действия",
    statuses: [
      "draft",
      "action_required",
      "under_review",
      "clarification",
      "approval",
      "blocked",
      "active",
    ],
  },
  {
    id: "done",
    title: "Одобрено и опубликовано",
    statuses: ["approved", "published"],
  },
  {
    id: "closed",
    title: "Завершено и отклонено",
    statuses: ["closed", "archived", "rejected"],
  },
];

export interface QueueViewProps {
  tasks: readonly OperationalTask[];
  /** Календарная дата «сегодня» (YYYY-MM-DD). */
  today: string;
  /** Общее число задач по запросу (для подписи переключателя). */
  total: number;
}

export function QueueView({ tasks, today, total }: QueueViewProps) {
  const [mode, setMode] = useState<ViewMode>("table");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-secondary">
          {mode === "table" ? (
            <>
              Показано задач: <strong className="font-semibold text-primary">{total}</strong>.
              Таблица — основной вид очереди.
            </>
          ) : (
            <>
              Канбан — дополнительный вид. Таблица с полным составом колонок
              доступна по кнопке «Таблица».
            </>
          )}
        </p>
        <div
          role="group"
          aria-label="Вид очереди"
          className="inline-flex rounded-control border border-subtle bg-surface p-0.5"
        >
          <button
            type="button"
            onClick={() => setMode("table")}
            aria-pressed={mode === "table"}
            className={`inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
              mode === "table"
                ? "bg-accent-strong text-accent-contrast"
                : "text-secondary hover:bg-surface-elevated hover:text-primary"
            }`}
          >
            <LayoutList className="h-4 w-4" aria-hidden />
            Таблица
          </button>
          <button
            type="button"
            onClick={() => setMode("kanban")}
            aria-pressed={mode === "kanban"}
            className={`inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
              mode === "kanban"
                ? "bg-accent-strong text-accent-contrast"
                : "text-secondary hover:bg-surface-elevated hover:text-primary"
            }`}
          >
            <KanbanSquare className="h-4 w-4" aria-hidden />
            Канбан
          </button>
        </div>
      </div>

      {mode === "table" ? (
        <OpsQueueTable tasks={tasks} today={today} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {KANBAN_COLUMNS.map((column) => {
            const columnTasks = tasks.filter((task) =>
              column.statuses.includes(task.status),
            );
            return (
              <section
                key={column.id}
                aria-label={`Колонка «${column.title}»`}
                className="rounded-panel border border-subtle bg-surface/60 p-3"
              >
                <header className="flex items-center justify-between gap-2 px-1 pb-2">
                  <h2 className="text-small font-semibold text-primary">
                    {column.title}
                  </h2>
                  <span className="rounded-[6px] bg-canvas px-2 py-0.5 font-mono text-meta text-muted">
                    {columnTasks.length}
                  </span>
                </header>
                {columnTasks.length === 0 ? (
                  <p className="rounded-control border border-dashed border-subtle px-3 py-6 text-center text-meta text-muted">
                    Нет задач
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {columnTasks.map((task) => (
                      <li
                        key={task.id}
                        className="rounded-control border border-subtle bg-surface p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <ObjectTypeLabel type={task.objectType} />
                          <StatusBadge status={task.status} size="sm" />
                        </div>
                        <TaskObjectLink
                          task={task}
                          className="mt-2 line-clamp-2 block text-small"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
                          <PriorityBadge priority={task.priority} />
                          <span>{TASK_TYPE_LABELS[task.taskType]}</span>
                          <DueDateCell
                            dueDate={task.dueDate}
                            overdue={Boolean(
                              task.dueDate && task.dueDate < today,
                            )}
                          />
                        </div>
                        <p className="mt-2 line-clamp-2 text-meta text-secondary">
                          {task.nextAction === "—" ? "Задача завершена" : task.nextAction}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
