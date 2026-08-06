/**
 * T-009. Навигация кабинета исполнителя (ROLES.md partner journey).
 *
 * Задача-first: кабинет → технологии → заявки → запросы заказчиков →
 * пилоты. Тот же набор маршрутов подключён в sidebar (T-003); горизонтальная
 * навигация дублирует его для страниц кабинета, как в кабинете заказчика
 * (T-008, CustomerNav).
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileUp,
  FlaskConical,
  Inbox,
  LayoutDashboard,
  Rocket,
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
  { href: "/app/partner", label: "Кабинет", icon: LayoutDashboard, exact: true },
  { href: "/app/partner/technologies", label: "Технологии", icon: FlaskConical },
  { href: "/app/partner/applications", label: "Заявки", icon: FileUp },
  { href: "/app/partner/requests", label: "Запросы заказчиков", icon: Inbox },
  { href: "/app/partner/pilots", label: "Пилоты", icon: Rocket },
];

export function PartnerNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Кабинет исполнителя" className="mb-8">
      <div
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
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
