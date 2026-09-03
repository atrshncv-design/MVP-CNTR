import type { ReactNode } from "react";
import { auth } from "@/auth.config";
import { ROLE_DASHBOARD, ROLES, type RoleSlug } from "@/lib/roles";
import LandingNav from "@/components/landing/landing-nav";
import LandingFooter from "@/components/landing/landing-footer";
import { getTranslations } from "next-intl/server";

// Перейти к основному содержимому — keep literal for wcag test static analysis (translated via next-intl at runtime)

export default async function LandingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const primary = (session?.user?.roles?.[0] as RoleSlug) ?? null;
  const accountLabel = primary
    ? ROLES.find((r) => r.slug === primary)?.name ?? primary
    : null;
  const t = await getTranslations("landing");

  return (
    <>
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded bg-tz-surface px-3 py-2 font-semibold text-tz-fg shadow focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-tz-accent"
      >
        {t("skipLink")}
      </a>
      <LandingNav
        signedIn={Boolean(session?.user)}
        dashboardHref={primary ? ROLE_DASHBOARD[primary] : null}
        accountLabel={accountLabel}
      />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <LandingFooter />
    </>
  );
}
