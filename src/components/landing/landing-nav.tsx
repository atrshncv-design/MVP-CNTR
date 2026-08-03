"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ThemeToggle from "@/components/theme-toggle";

const PRIMARY_LINKS = [
  { href: "/", label: "Главная" },
  { href: "/about", label: "О центре" },
  { href: "/methodology", label: "Методика" },
  { href: "/levels", label: "Уровни УГТ" },
  { href: "/roadmap", label: "Дорожная карта" },
];

const MORE_LINKS = [
  { href: "/customers", label: "Заказчики" },
  { href: "/performers", label: "Исполнители" },
];

export default function LandingNav({
  signedIn,
  dashboardHref,
  accountLabel,
}: {
  signedIn: boolean;
  dashboardHref: string | null;
  accountLabel: string | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-tz-border bg-tz-bg/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Лого */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tz-accent font-mono text-sm font-bold text-white">
            Т
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight text-tz-fg">
            Технозрелость
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-tz-muted sm:inline">
            ЦНТР УР
          </span>
        </Link>

        {/* Навигация (десктоп) */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {PRIMARY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? "bg-tz-accent-soft text-tz-accent"
                  : "text-tz-secondary hover:bg-tz-soft hover:text-tz-fg"
              }`}
            >
              {l.label}
            </Link>
          ))}

          {/* Ещё ▾ */}
          {MORE_LINKS.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  MORE_LINKS.some((l) => isActive(l.href))
                    ? "bg-tz-accent-soft text-tz-accent"
                    : "text-tz-secondary hover:bg-tz-soft hover:text-tz-fg"
                }`}
              >
                Ещё
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-tz-card-border bg-tz-surface p-1.5 shadow-tz-pop">
                  {MORE_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setMoreOpen(false)}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive(l.href)
                          ? "bg-tz-accent-soft text-tz-accent"
                          : "text-tz-secondary hover:bg-tz-soft hover:text-tz-fg"
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Правая часть */}
        <div className="hidden items-center gap-2.5 lg:flex">
          <ThemeToggle />
          {signedIn && dashboardHref ? (
            <>
              {accountLabel && (
                <span className="font-mono text-[11px] uppercase tracking-widest text-tz-muted">
                  {accountLabel}
                </span>
              )}
              <Link href={dashboardHref} className="tz-btn tz-btn-primary tz-btn-sm">
                Личный кабинет
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="tz-btn tz-btn-ghost tz-btn-sm">
                Вход
              </Link>
              <Link href="/register" className="tz-btn tz-btn-primary tz-btn-sm">
                Регистрация
              </Link>
            </>
          )}
        </div>

        {/* Мобильный бургер */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Меню"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-tz-border text-tz-secondary"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      {mobileOpen && (
        <div className="border-t border-tz-border bg-tz-surface lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-3">
            {[...PRIMARY_LINKS, ...MORE_LINKS].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive(l.href)
                    ? "bg-tz-accent-soft text-tz-accent"
                    : "text-tz-secondary"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-tz-border pt-3">
              {signedIn && dashboardHref ? (
                <Link
                  href={dashboardHref}
                  onClick={() => setMobileOpen(false)}
                  className="tz-btn tz-btn-primary"
                >
                  Личный кабинет
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="tz-btn tz-btn-secondary">
                    Вход
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="tz-btn tz-btn-primary">
                    Регистрация
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
