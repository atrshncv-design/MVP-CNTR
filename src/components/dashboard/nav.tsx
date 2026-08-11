"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { isNavItemActive, type NavItem } from "@/lib/navigation";

/**
 * Навигация единого dashboard shell (тикет 01, internal-frontend).
 * - Desktop/планшет (md+): горизонтальная навигация, активный пункт получает
 *   aria-current="page" (точное совпадение или префикс для вложенных страниц).
 * - Mobile (<md): кнопка-меню (aria-expanded/aria-controls, закрытие по Escape и
 *   после перехода) + панель со ссылками.
 * - Семантика: landmarks <nav aria-label="...">, фокус видимый — глобальное
 *   правило :focus-visible в globals.css.
 */

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isNavItemActive(item, pathname);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-tz-muted transition hover:bg-tz-surface/[0.06] hover:text-white aria-[current=page]:bg-tz-surface/[0.08] aria-[current=page]:text-white"
    >
      <span className="flex items-center gap-2">
        {item.label}
        {item.badge && (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-300">
            {item.badge}
          </span>
        )}
      </span>
    </Link>
  );
}

/** Desktop/планшетная навигация (скрыта на mobile — там MobileNavToggle). */
export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Основная навигация"
      className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}

/** Мобильная навигация: кнопка + выпадающая панель (только <md). */
export function MobileNavToggle({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Закрытие по Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-dashboard-nav"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        className="grid h-11 w-11 place-items-center rounded-lg text-tz-muted transition hover:bg-tz-surface/[0.06] hover:text-white"
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      {open && (
        <nav
          id="mobile-dashboard-nav"
          aria-label="Основная навигация (мобильная)"
          className="absolute inset-x-0 top-full z-50 border-b border-white/[0.07] bg-[#0a101f]/95 p-4 backdrop-blur-xl"
        >
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} pathname={pathname} onNavigate={close} />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
