import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Единый breadcrumb (тикет 03 internal-ux-redesign).
 * Серверо-безопасный презентационный компонент: рендерит навигационную
 * цепочку «Рабочий стол / Раздел / …»; последний элемент — текущая
 * страница (не ссылка, `aria-current="page"`); разделители — ChevronRight.
 * Цепочка по умолчанию генерируется из pathname в dashboard-breadcrumb.tsx;
 * страницы могут переопределить её через useBreadcrumb (там же).
 */
export default function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav aria-label="Хлебные крошки" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight size={14} aria-hidden className="shrink-0 text-tz-muted" />
              ) : null}
              {isLast ? (
                <span aria-current="page" className="truncate text-sm font-semibold text-tz-fg">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="truncate text-sm text-tz-muted transition hover:text-tz-accent"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate text-sm text-tz-muted">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
