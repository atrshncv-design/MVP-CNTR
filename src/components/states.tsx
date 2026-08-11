import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Единые loading / error / empty states dashboard shell (тикет 01, internal-frontend).
 * Визуально повторяют прежние инлайновые паттерны страниц ролей, но вынесены
 * в общие компоненты — без копипаста. Семантика: role="status" (loading) и
 * role="alert" (error), чтобы скринридеры объявляли смену состояния.
 */

/** Примитив-скелетон: пульсирующий блок под токены темы. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-tz-surface-2 ${className}`} aria-hidden="true" />;
}

/**
 * Скелетон карточки (стандартный паттерн «заголовок + тело» страниц ролей).
 * Используется для loading-состояний списков и реестров.
 */
export function CardSkeleton({ bodyClassName = "h-16" }: { bodyClassName?: string }) {
  return (
    <div className="rounded-[14px] border border-tz-border bg-tz-surface p-6" role="status" aria-label="Загрузка">
      <Skeleton className="h-5 w-48" />
      <Skeleton className={`mt-4 ${bodyClassName} bg-tz-soft`} />
    </div>
  );
}

/** Полноэкранный/блочный loading-индикатор. */
export function LoadingState({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 rounded-[14px] border border-tz-border bg-tz-surface py-14"
    >
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-tz-border border-t-tz-accent"
        aria-hidden="true"
      />
      <span className="text-sm text-tz-muted">{label}</span>
    </div>
  );
}

/** Единый error-блок: сообщение + кнопка «Повторить» (опционально). */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-tz-danger bg-tz-danger-soft p-8 text-center"
    >
      <AlertCircle className="mx-auto mb-2 text-tz-danger" size={36} aria-hidden="true" />
      <p className="font-semibold text-tz-danger">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <RefreshCw size={14} aria-hidden="true" /> Повторить
        </button>
      )}
    </div>
  );
}

/** Единый empty-блок: иконка + заголовок + пояснение + опциональное действие. */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EAF0FF]" aria-hidden="true">
        {icon}
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-tz-fg">{title}</h2>
      {text && <p className="mx-auto mt-3 max-w-xl text-tz-secondary">{text}</p>}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}
