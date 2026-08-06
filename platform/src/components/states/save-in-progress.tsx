/**
 * T-005. Индикатор сохранения (STATES.md §3 «Success» + UX черновиков).
 * Неблокирующий inline-статус: «Сохраняем…» (спиннер), «Сохранено» (чек +
 * время последнего сохранения), «Не удалось сохранить» (ошибка). Форма не
 * блокируется — пользователь продолжает работу, статус обновляется.
 */

import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";

export type SavePhase = "saving" | "saved" | "error";

export interface SaveInProgressProps {
  /** Фаза сохранения. */
  phase?: SavePhase;
  /** Собственная подпись операции (по умолчанию «Сохраняем…»/«Сохранено»). */
  label?: string;
  /** Время последнего успешного сохранения (для фазы saved). */
  savedAt?: Date | string;
}

const PHASE_TEXT: Record<SavePhase, string> = {
  saving: "Сохраняем…",
  saved: "Сохранено",
  error: "Не удалось сохранить",
};

export function SaveInProgress({
  phase = "saving",
  label,
  savedAt,
}: SaveInProgressProps) {
  const text = label ?? PHASE_TEXT[phase];

  if (phase === "saving") {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-2 text-small text-secondary"
      >
        <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
        {text}
      </span>
    );
  }

  if (phase === "error") {
    return (
      <span
        role="alert"
        className="inline-flex items-center gap-2 text-small font-medium text-status-danger"
      >
        <TriangleAlert className="h-4 w-4" aria-hidden />
        {text}
      </span>
    );
  }

  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 text-small text-status-success"
    >
      <CheckCircle2 className="h-4 w-4" aria-hidden />
      {text}
      {savedAt ? (
        <span className="font-mono text-meta text-muted">
          · {formatDateTime(savedAt)}
        </span>
      ) : null}
    </span>
  );
}
