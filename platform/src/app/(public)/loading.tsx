/**
 * T-002. Скелет загрузки публичной страницы: header/футер из layout
 * остаются на месте, в main показывается каркас контента.
 */
export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-12 md:px-8 md:py-20">
      <div className="max-w-3xl">
        <div className="h-10 w-2/3 animate-pulse rounded-control bg-surface-elevated" />
        <div className="mt-5 h-5 w-full animate-pulse rounded-control bg-surface-elevated" />
        <div className="mt-2.5 h-5 w-5/6 animate-pulse rounded-control bg-surface-elevated" />
        <div className="mt-2.5 h-5 w-4/6 animate-pulse rounded-control bg-surface-elevated" />
      </div>
      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <div className="h-12 w-52 animate-pulse rounded-control bg-surface-elevated" />
        <div className="h-12 w-52 animate-pulse rounded-control bg-surface-elevated" />
      </div>
      <div className="mt-16 h-px animate-pulse bg-border-subtle" />
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-panel bg-surface-elevated" />
        <div className="h-64 animate-pulse rounded-panel bg-surface-elevated" />
      </div>
    </div>
  );
}
