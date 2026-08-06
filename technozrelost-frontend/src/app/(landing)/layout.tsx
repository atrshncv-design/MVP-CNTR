import type { ReactNode } from "react";
import { auth } from "@/auth.config";
import { ROLE_DASHBOARD, ROLES, type RoleSlug } from "@/lib/roles";
import LandingNav from "@/components/landing/landing-nav";
import LandingFooter from "@/components/landing/landing-footer";

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

  return (
    <>
      <LandingNav
        signedIn={Boolean(session?.user)}
        dashboardHref={primary ? ROLE_DASHBOARD[primary] : null}
        accountLabel={accountLabel}
      />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </>
  );
}
