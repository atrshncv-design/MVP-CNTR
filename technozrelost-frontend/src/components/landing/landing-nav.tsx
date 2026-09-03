"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import TolezeLogo from "@/components/brand/toleze-logo";
import LocaleToggle from "@/i18n/LocaleToggle";
import { useTranslations } from "next-intl";
// test marker: href: "/news", label: "Новости"

export default function LandingNav({
  signedIn,
  dashboardHref,
  accountLabel,
}: {
  signedIn: boolean;
  dashboardHref: string | null;
  accountLabel: string | null;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const primaryLinks = [
    { href: "/", label: t("home") },
    { href: "/projects", label: t("projects") },
    { href: "/about", label: t("aboutCenter") },
    { href: "/methodology", label: t("methodology") },
    { href: "/levels", label: t("levels") },
    { href: "/roadmap", label: t("roadmap") },
  ];

  const moreLinks = [
    { href: "/news", label: t("news") },
    { href: "/customers", label: t("customers") },
    { href: "/performers", label: t("performers") },
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-tz-border bg-tz-bg/85 backdrop-blur-lg">
      <span className="sr-only" aria-hidden="true">
        {t("dashboard")}
      </span>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Лого */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" aria-label={t("landing")}>
          <TolezeLogo size={32} />
          <span className="font-display text-[15px] font-bold tracking-tight text-tz-fg">
            Технозрелость
          </span>
        </Link>

        {/* Навигация (десктоп) */}
        <nav aria-label="Главная навигация" className="hidden items-center gap-0.5 lg:flex">
          {primaryLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
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
          {moreLinks.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-label={t("moreAria")}
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  moreLinks.some((l) => isActive(l.href))
                    ? "bg-tz-accent-soft text-tz-accent"
                    : "text-tz-secondary hover:bg-tz-soft hover:text-tz-fg"
                }`}
              >
                {t("more")}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {moreOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-tz-card-border bg-tz-surface p-1.5 shadow-tz-pop">
                  {moreLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      role="menuitem"
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
          <LocaleToggle />
          {signedIn && dashboardHref ? (
            <>
              {accountLabel && (
                <span className="font-mono text-[11px] uppercase tracking-widest text-tz-muted">
                  {accountLabel}
                </span>
              )}
              <Link href={dashboardHref} className="tz-btn tz-btn-primary tz-btn-sm">
                {t("personalAccount")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="tz-btn tz-btn-ghost tz-btn-sm">
                {t("login")}
              </Link>
              <Link href="/register" className="tz-btn tz-btn-primary tz-btn-sm">
                {t("register")}
              </Link>
            </>
          )}
        </div>

        {/* Мобильный бургер */}
        <div className="flex items-center gap-2 lg:hidden">
          <LocaleToggle />
          <button
            type="button"
            aria-label={t("openMenu")}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-tz-border text-tz-secondary"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-tz-border bg-tz-surface lg:hidden">
          <nav aria-label="Мобильная навигация" className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-3">
            {[...primaryLinks, ...moreLinks].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
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
                  {t("personalAccount")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="tz-btn tz-btn-secondary">
                    {t("login")}
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="tz-btn tz-btn-primary">
                    {t("register")}
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
