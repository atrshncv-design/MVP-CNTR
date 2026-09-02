import RoleDashboardShell from "@/features/dashboard/RoleDashboardShell";
import { ManagerAnalytics } from "@/features/analytics";

/**
 * Менеджер — урезанная аналитика (тикет 08, G33.1).
 * Только очередь drafts/promotions + 3 stat-cards + воронка по своим проектам,
 * без отраслей/муниципалитетов. Очередь верификации организаций остаётся в shell.
 */
export default function Page() {
  return (
    <>
      <RoleDashboardShell role="cntr_manager" />
      <div className="mt-8">
        <ManagerAnalytics />
      </div>
    </>
  );
}
