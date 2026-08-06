/**
 * T-005. Состояние успеха (STATES.md §3 «Success»): подтверждает реально
 * выполненную операцию и показывает следующее действие. Пример из STATES.md:
 * «Черновик сохранён» + «Открыть проект» + «Продолжить позже».
 */

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

export interface SuccessStateProps {
  /** Подтверждение операции, например «Черновик сохранён». */
  title: string;
  /** Детали результата (что именно подтверждено). */
  description?: ReactNode;
  /** Следующие действия (ReactNode — кнопки/ссылки ≥44px). */
  actions?: ReactNode;
}

export function SuccessState({
  title,
  description,
  actions,
}: SuccessStateProps) {
  return (
    <div
      role="status"
      className="rounded-panel border border-status-success/40 bg-surface p-6"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-status-success-soft"
          aria-hidden
        >
          <CheckCircle2 className="h-5 w-5 text-status-success" />
        </span>
        <div className="min-w-0">
          <h3 className="text-h3 font-semibold tracking-tight text-primary">
            {title}
          </h3>
          {description ? (
            <div className="mt-2 max-w-2xl text-small leading-relaxed text-secondary">
              {description}
            </div>
          ) : null}
          {actions ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
