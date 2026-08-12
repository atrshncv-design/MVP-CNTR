/**
 * Skeleton-состояние загрузки ЛК (тикет 03 internal-ux-redesign).
 * Честная заглушка без фейковых данных: показывает только структуру
 * (breadcrumb, заголовок, карточки) с пульсацией. При prefers-reduced-motion
 * анимация отключается (motion-reduce:animate-none + глобальное правило
 * в globals.css).
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Загрузка раздела">
      {/* Breadcrumb */}
      <div className="h-4 w-56 max-w-full animate-pulse rounded bg-tz-surface-2 motion-reduce:animate-none" />
      {/* Заголовок */}
      <div className="space-y-2">
        <div className="h-3 w-28 max-w-full animate-pulse rounded bg-tz-surface-2 motion-reduce:animate-none" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-tz-surface-2 motion-reduce:animate-none" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-tz-surface-2 motion-reduce:animate-none" />
      </div>
      {/* Карточки */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-tz-card-border bg-tz-surface p-5"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-tz-surface-2 motion-reduce:animate-none" />
            <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-tz-surface-2 motion-reduce:animate-none" />
            <div className="mt-4 h-14 animate-pulse rounded-lg bg-tz-surface-2 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
