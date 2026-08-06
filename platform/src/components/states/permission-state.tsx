/**
 * T-005. Состояние отсутствия доступа (STATES.md §3 «Permission»).
 * Объясняет, что запись существует или раздел ограничен (когда это известно),
 * и даёт путь запроса доступа / контакта с Центром, когда он поддерживается.
 * Не раскрывает содержимое закрытого объекта.
 */

import type { ReactNode } from "react";
import { Lock } from "lucide-react";

export interface PermissionStateProps {
  /** Заголовок состояния. */
  title?: string;
  /** Объяснение причины ограничения. */
  description?: ReactNode;
  /** Действие: запросить доступ / связаться с Центром (≥44px). */
  action?: ReactNode;
  /**
   * Известно ли, что запись существует: true — «запись существует, доступ
   * ограничен», false — «раздел ограничен» (STATES.md §3).
   */
  recordExists?: boolean;
}

export function PermissionState({
  title,
  description,
  action,
  recordExists = true,
}: PermissionStateProps) {
  const heading =
    title ?? (recordExists ? "Запись существует, доступ ограничен" : "Нет доступа к этому разделу");
  const defaultDescription = recordExists
    ? "Объект существует, но его содержимое доступно только участникам с соответствующими правами."
    : "Раздел доступен только авторизованным участникам с соответствующими правами.";

  return (
    <div className="rounded-panel border border-subtle bg-surface p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-canvas"
          aria-hidden
        >
          <Lock className="h-5 w-5 text-secondary" />
        </span>
        <div className="min-w-0">
          <h3 className="text-h3 font-semibold tracking-tight text-primary">
            {heading}
          </h3>
          <p className="mt-2 max-w-2xl text-small leading-relaxed text-secondary">
            {description ?? defaultDescription}
          </p>
          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
