import { redirect } from "next/navigation";
import { auth } from "@/auth.config";
import { ROLE_DASHBOARD, type RoleSlug } from "@/lib/roles";

// /dashboard/: role resolver -> конкретный кабинет по primary роли.
export default async function DashboardIndex() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");
  const primary = (session.user.roles[0] as RoleSlug) ?? "gk_customer";
  redirect(ROLE_DASHBOARD[primary]);
}