"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Главная" },
  { href: "/about", label: "О центре" },
  { href: "/methodology", label: "Методика" },
  { href: "/levels", label: "Уровни УГТ" },
  { href: "/customers", label: "Заказчики" },
  { href: "/performers", label: "Исполнители" },
  { href: "/roadmap", label: "Дорожная карта" },
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
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-tz-border/70 bg-tz-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg tz-grad-bg font-mono text-sm font-bold text-white">
            Т
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight text-tz-fg">
            Технозрелость
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-tz-muted sm:inline">
            ЦНТР УР
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-tz-soft text-tz-fg"
                    : "text-tz-secondary hover:bg-tz-soft/60 hover:text-tz-fg"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {signedIn && dashboardHref ? (
            <>
              {accountLabel && (
                <span className="font-mono text-[11px] uppercase tracking-widest text-tz-muted">
                  {accountLabel}
                </span>
              )}
              <Link href={dashboardHref} className="tz-btn tz-btn-primary tz-btn-sm">
                Войти в личный кабинет
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

        <button
          type="button"
          aria-label="Меню"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-tz-border text-tz-secondary lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-tz-border/70 bg-tz-surface lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {LINKS.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-tz-soft text-tz-fg" : "text-tz-secondary"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="mt-2 flex flex-col gap-2 border-t border-tz-border/70 pt-3">
              {signedIn && dashboardHref ? (
                <Link
                  href={dashboardHref}
                  onClick={() => setOpen(false)}
                  className="tz-btn tz-btn-primary"
                >
                  Войти в личный кабинет
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="tz-btn tz-btn-secondary">
                    Вход
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="tz-btn tz-btn-primary"
                  >
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
