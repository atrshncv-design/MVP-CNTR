/**
 * T-008. Навигация кабинета заказчика (ROLES.md customer journey).
 *
 * Пока T-003 (shell кабинета) не построен, страницы кабинета компилируются
 * через root layout и навигируются этим компонентом; T-003 подключит тот же
 * набор маршрутов в sidebar. Навигация — задача-first: кабинет → запросы →
 * поиск решений → шорт-листы → пилоты.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderHeart,
  LayoutDashboard,
  ListChecks,
  Rocket,
  Search,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Точное совпадение (корень кабинета). */
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/app/customer", label: "Кабинет", icon: LayoutDashboard, exact: true },
  { href: "/app/customer/requests", label: "Запросы", icon: ListChecks },
  { href: "/app/customer/search", label: "Поиск решений", icon: Search },
  { href: "/app/customer/shortlists", label: "Шорт-листы", icon: FolderHeart },
  { href: "/app/customer/pilots", label: "Пилоты", icon: Rocket },
];

export function CustomerNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Кабинет заказчика" className="mb-8">
      <div
        className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1"
        role="tablist"
        aria-label="Разделы кабинета"
      >
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={active}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-control px-4 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-secondary hover:bg-surface hover:text-primary"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
