/**
 * T-006. Счётчик результатов реестра — ТОЛЬКО по реальным данным
 * (Page.total из адаптера; Design.md §11.4 «result count only when
 * sourced from real data»). При отсутствии данных счётчик не выводится:
 * вызывающий код показывает EmptyState.
 */

export interface ResultCountProps {
  /** Общее число записей по запросу (реальное, из Page.total). */
  total: number;
  /** Текущая страница. */
  page: number;
  /** Размер страницы. */
  pageSize: number;
}

export function ResultCount({ total, page, pageSize }: ResultCountProps) {
  if (total <= 0) {
    return (
      <p role="status" className="text-small text-muted">
        Записей не найдено
      </p>
    );
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <p role="status" className="flex flex-wrap items-baseline gap-x-2 text-small text-secondary">
      <span>
        Найдено записей:{" "}
        <strong className="font-semibold text-primary">{total}</strong>
      </span>
      <span className="text-muted" aria-hidden>
        ·
      </span>
      <span className="text-muted">
        показаны {from}–{to}
      </span>
    </p>
  );
}
