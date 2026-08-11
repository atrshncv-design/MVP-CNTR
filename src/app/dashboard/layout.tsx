import { auth } from "@/auth.config";

import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;

  return (
    <DashboardShell
      userName={user?.name}
      roles={user?.roles ?? []}
    >
      {children}
    </DashboardShell>
  );
}
