/**
 * T-005. Пустое состояние (STATES.md §3 «Empty»): объясняет, почему список
 * пуст, и предлагает следующее осмысленное действие. Примеры формулировок
 * из STATES.md: «Пока нет опубликованных технологий по этому фильтру»,
 * «У вашей организации пока нет запросов», «Очередь пуста», «По заданным
 * условиям записи не найдены».
 *
 * Действие — ReactNode (кнопка/ссылка ≥44px), передаётся вызывающим кодом:
 * компонент не выдумывает маршруты.
 */

import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  /** Заголовок пустого состояния. */
  title: string;
  /** Объяснение, почему список пуст (обязательно по STATES.md). */
  description?: ReactNode;
  /** Следующее действие (кнопка/ссылка, тач-цель ≥44px). */
  action?: ReactNode;
  /** Иконка состояния (по умолчанию Inbox). */
  icon?: LucideIcon;
  /** Компактный вариант: меньше отступов, для вложенных секций. */
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-panel border border-dashed border-subtle bg-surface text-center ${
        compact ? "px-5 py-8" : "px-6 py-14"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-control bg-canvas ${
          compact ? "h-10 w-10" : "h-14 w-14"
        }`}
        aria-hidden
      >
        <Icon className={compact ? "h-5 w-5" : "h-7 w-7"} strokeWidth={1.75} />
      </span>
      <h3
        className={`mt-4 font-semibold tracking-tight text-primary ${
          compact ? "text-body" : "text-h3"
        }`}
      >
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-small leading-relaxed text-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
