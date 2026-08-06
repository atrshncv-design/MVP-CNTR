/**
 * T-010. Аналитика Центра (/operations/analytics).
 * Счётчики ТОЛЬКО из реальных/фикстурных данных с указанием источника
 * (OpsAnalytics: бейдж «Реальные данные» / «Фикстуры UI (демо)»).
 */

import { Activity, Building2, FileSearch, FlaskConical, Layers, Rocket } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { operationalTaskFixtures } from "@/data/fixtures";
import { OpsAnalytics } from "@/components/operations/ops-analytics";
import { ErrorState } from "@/components/states/error-state";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export const dynamic = "force-dynamic";

export default async function OperationsAnalyticsPage() {
  let researchTotal = 0;
  let orgTotal = 0;
  try {
    const [research, organizations] = await Promise.all([
      getAdapter().listResearch({ pageSize: 1 }),
      getAdapter().listOrganizations({ pageSize: 1 }),
    ]);
    researchTotal = research.total;
    orgTotal = organizations.total;
  } catch {
    return (
      <div className={CONTAINER}>
        <ErrorState
          title="Не удалось загрузить аналитику"
          description="Сервис данных временно недоступен. Повторите попытку позже."
        />
      </div>
    );
  }

  const tasks = operationalTaskFixtures;
  const openTasks = tasks.filter(
    (t) => t.status !== "closed" && t.status !== "archived" && t.status !== "rejected",
  ).length;
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10),
  ).length;
  const withMissingEvidence = tasks.filter((t) => t.missingEvidenceSummary).length;

  const statusCounts = new Map<string, number>();
  for (const task of tasks) {
    statusCounts.set(task.status, (statusCounts.get(task.status) ?? 0) + 1);
  }

  return (
    <div className={CONTAINER}>
      <header>
        <h1 className="flex items-center gap-2 text-h2 font-semibold tracking-tight text-primary">
          <Activity className="h-6 w-6 text-accent" aria-hidden />
          Аналитика
        </h1>
        <p className="mt-1.5 text-small text-secondary">
          Показатели платформы. Каждое число имеет источник — выдуманных
          метрик нет (STATES.md §3).
        </p>
      </header>

      <div className="mt-6">
        <OpsAnalytics
          metrics={[
            {
              label: "Записей НИОКТР",
              value: researchTotal,
              source: "реестр НИОКТР (МИНОБРНАУКИ России)",
              real: true,
              icon: FlaskConical,
            },
            {
              label: "Организаций в реестре",
              value: orgTotal,
              source: "справочник НИОКТР (реальные данные)",
              real: true,
              icon: Building2,
            },
            {
              label: "Задач в очереди",
              value: tasks.length,
              source: "операционные задачи (фикстуры UI)",
              icon: Layers,
            },
            {
              label: "Открытых задач",
              value: openTasks,
              source: "фикстуры UI (демо)",
              icon: FileSearch,
            },
            {
              label: "Просроченных задач",
              value: overdueTasks,
              source: "фикстуры UI (демо)",
              icon: Activity,
            },
            {
              label: "С недостающими свидетельствами",
              value: withMissingEvidence,
              source: "фикстуры UI (демо)",
              icon: Rocket,
            },
          ]}
          statusBreakdown={[...statusCounts.entries()].map(([label, count]) => ({
            label,
            count,
          }))}
          sourcesNote="Реальные данные: реестр НИОКТР и справочник организаций. Остальное — контролируемые фикстуры интерфейса, не публикуемые в открытых реестрах."
        />
      </div>
    </div>
  );
}
