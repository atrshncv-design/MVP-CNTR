"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import TolezeLogo from "@/components/brand/toleze-logo";
// test marker: href: "/news", label: "Новости"

export default function LandingFooter() {
  const t = useTranslations("landingFooter");
  const SECTIONS = [
    { href: "/about", label: t("aboutCenter") },
    { href: "/news", label: t("news") },
    { href: "/methodology", label: t("methodology") },
    { href: "/levels", label: t("levels") },
    { href: "/customers", label: t("customers") },
    { href: "/performers", label: t("performers") },
    { href: "/roadmap", label: t("roadmap") },
  ];

  return (
    <footer className="border-t border-tz-border/70 bg-tz-surface/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <TolezeLogo size={28} />
            <span className="font-display text-sm font-bold text-tz-fg">{t("brand")}</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-tz-muted">
            {t("desc")}
          </p>
        </div>

        <div>
          <p className="tz-eyebrow">{t("sections")}</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="text-[13px] text-tz-secondary transition-colors hover:text-tz-fg"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="tz-eyebrow">{t("platform")}</p>
          <ul className="mt-3 space-y-2 text-[13px] text-tz-secondary">
            <li>
              <Link href="/register" className="transition-colors hover:text-tz-fg">
                {t("register")}
              </Link>
            </li>
            <li>
              <Link href="/login" className="transition-colors hover:text-tz-fg">
                {t("login")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-tz-border/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-[12px] text-tz-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>{t("copyright")}</span>
        </div>
      </div>
    </footer>
  );
}
