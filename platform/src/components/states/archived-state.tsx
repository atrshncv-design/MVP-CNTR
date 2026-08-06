/**
 * T-005. Состояние архивного объекта (STATES.md §1 archived + §3):
 * объект больше не активен и не публичен по умолчанию; дата архивации —
 * когда известна; действие — открыть архив/восстановить, если поддерживается.
 */

import type { ReactNode } from "react";
import { Archive } from "lucide-react";
import { formatDate } from "@/lib/datetime";

export interface ArchivedStateProps {
  /** Заголовок (по умолчанию «Объект в архиве»). */
  title?: string;
  /** Дата архивации (если известна — не фабрикуется). */
  archivedAt?: Date | string | null;
  /** Объяснение состояния. */
  description?: ReactNode;
  /** Действие: открыть архив / восстановить (≥44px). */
  action?: ReactNode;
}

export function ArchivedState({
  title = "Объект в архиве",
  archivedAt,
  description = "Объект больше не активен и скрыт из публичных реестров. Содержимое сохранено и доступно в архиве.",
  action,
}: ArchivedStateProps) {
  return (
    <div className="rounded-panel border border-subtle bg-surface p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-canvas"
          aria-hidden
        >
          <Archive className="h-5 w-5 text-muted" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-h3 font-semibold tracking-tight text-primary">
              {title}
            </h3>
            {archivedAt ? (
              <p className="font-mono text-meta text-muted">
                архивировано {formatDate(archivedAt)}
              </p>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-small leading-relaxed text-secondary">
            {description}
          </p>
          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
