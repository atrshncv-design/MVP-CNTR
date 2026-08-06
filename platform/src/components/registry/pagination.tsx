/**
 * T-006. Пагинация реестра: обычные ссылки (серверный компонент) —
 * URL-состояние сохраняется, работают «назад/вперёд» и средняя кнопка.
 * Окно страниц с многоточиями; размер страницы не превышает
 * MAX_PAGE_SIZE=100 адаптера (задаётся в REGISTRY_PAGE_SIZE).
 */

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  /** Текущая страница (≥1). */
  page: number;
  /** Всего страниц (из Page.totalPages). */
  totalPages: number;
  /** Построить href для заданной страницы (сохраняя search/filters/sort). */
  buildHref: (page: number) => string;
  /** Компактная подпись для скринридеров. */
  ariaLabel?: string;
}

/** Окно номеров страниц: текущая ±1, первая и последняя, многоточия. */
function pageWindow(page: number, totalPages: number): (number | "…")[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

function linkClasses(active: boolean): string {
  return [
    "inline-flex h-10 min-w-10 items-center justify-center rounded-control px-2 text-small font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
    active
      ? "bg-accent-strong text-accent-contrast"
      : "border border-subtle bg-surface text-secondary hover:border-strong hover:text-primary",
  ].join(" ");
}

export function Pagination({
  page,
  totalPages,
  buildHref,
  ariaLabel = "Страницы реестра",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-meta text-muted">
        Страница {page} из {totalPages}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            aria-label="Предыдущая страница"
            className={linkClasses(false)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="sr-only">Назад</span>
          </Link>
        ) : null}

        {pageWindow(page, totalPages).map((item, index) =>
          item === "…" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden
              className="inline-flex h-10 w-4 items-center justify-center text-meta text-muted"
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={buildHref(item)}
              aria-current={item === page ? "page" : undefined}
              className={linkClasses(item === page)}
            >
              {item}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link
            href={buildHref(page + 1)}
            aria-label="Следующая страница"
            className={linkClasses(false)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
            <span className="sr-only">Вперёд</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
