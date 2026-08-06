/**
 * T-005. Скелет загрузки, сохраняющий структуру экрана (STATES.md §3).
 * Без фейковых счётчиков: показывается каркас в форме реального контента
 * (список/карточки/таблица/детали/форма) + доступный текст «Загружаем данные».
 * Адаптивен: сетки схлопываются на мобильных.
 */

export type SkeletonVariant = "list" | "card" | "table" | "detail" | "form";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-control bg-surface-elevated ${className}`} />;
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-panel border border-subtle bg-surface p-4"
        >
          <Block className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Block className="h-3.5 w-2/5" />
            <Block className="h-3 w-3/5" />
          </div>
          <Block className="h-6 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="rounded-panel border border-subtle bg-surface p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <Block className="h-6 w-24" />
            <Block className="h-6 w-16" />
          </div>
          <Block className="mt-4 h-3 w-full" />
          <Block className="mt-2 h-3 w-5/6" />
          <Block className="mt-2 h-3 w-2/3" />
          <div className="mt-5 flex items-center justify-between">
            <Block className="h-8 w-28" />
            <Block className="h-8 w-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-panel border border-subtle bg-surface">
      <div className="flex items-center gap-4 border-b border-subtle bg-canvas/60 px-4 py-3">
        <Block className="h-3 w-1/4" />
        <Block className="h-3 w-2/5" />
        <Block className="h-3 w-1/5" />
        <Block className="ml-auto h-3 w-16" />
      </div>
      <div className="divide-y divide-subtle">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Block className="h-3 w-24" />
            <Block className="h-3 w-2/5" />
            <Block className="h-3 w-28" />
            <Block className="ml-auto h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl flex-1 space-y-3">
          <Block className="h-8 w-2/3" />
          <Block className="h-4 w-full" />
          <Block className="h-4 w-5/6" />
        </div>
        <Block className="h-11 w-40" />
      </div>
      <div className="rounded-panel border border-subtle bg-surface p-6">
        <Block className="h-5 w-1/3" />
        <div className="mt-4 space-y-3">
          <Block className="h-3 w-full" />
          <Block className="h-3 w-11/12" />
          <Block className="h-3 w-4/5" />
          <Block className="h-3 w-2/3" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="max-w-2xl space-y-5 rounded-panel border border-subtle bg-surface p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <Block className="h-3 w-24" />
          <Block className="h-11 w-full" />
        </div>
        <div className="space-y-1.5">
          <Block className="h-3 w-20" />
          <Block className="h-11 w-full" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Block className="h-3 w-28" />
        <Block className="h-28 w-full" />
      </div>
      <div className="flex items-center gap-3">
        <Block className="h-11 w-40" />
        <Block className="h-11 w-32" />
      </div>
    </div>
  );
}

const VARIANT_VIEW: Record<SkeletonVariant, (rows: number) => React.ReactNode> =
  {
    list: (rows) => <ListSkeleton rows={rows} />,
    card: (rows) => <CardSkeleton rows={rows} />,
    table: (rows) => <TableSkeleton rows={rows} />,
    detail: () => <DetailSkeleton />,
    form: () => <FormSkeleton />,
  };

export interface LoadingSkeletonProps {
  /** Форма каркаса, повторяющая структуру экрана. */
  variant?: SkeletonVariant;
  /** Число строк/карточек (для list/card/table). */
  rows?: number;
  /** Доступная подпись; видимая строка «Загружаем данные…» всегда есть. */
  label?: string;
}

/**
 * Структурный скелет загрузки. role=status + aria-live, чтобы скринридеры
 * объявляли завершение загрузки, а не молчаливую смену блока.
 */
export function LoadingSkeleton({
  variant = "list",
  rows = 4,
  label = "Загружаем данные",
}: LoadingSkeletonProps) {
  const View = VARIANT_VIEW[variant];
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <p className="mb-4 text-small text-muted">Загружаем данные…</p>
      {View(rows)}
      <span className="sr-only">{label}</span>
    </div>
  );
}
