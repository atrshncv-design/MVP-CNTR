import RoleDashboardShell from "@/features/dashboard/RoleDashboardShell";
import { AdminAnalytics } from "@/features/analytics";

/**
 * Админ — макс аналитика (тикет 08, G33.1, G34).
 * 12 KPI → графики WeekBars, PercentRows, SectorRows + воронка draft→auto_confirmed→published→active→completed
 * + разрез по 30+ тегам (отрасли) + по регионам/муниципалитетам (из Organization.region).
 * Данные из GET /admin/achievements/stats + GET /projects агрегация фронт. Тест: воронка суммы = total.
 */
export default function Page() {
  return (
    <>
      <RoleDashboardShell role="cntr_admin" />
      <div className="mt-8">
        <AdminAnalytics />
      </div>
    </>
  );
}
