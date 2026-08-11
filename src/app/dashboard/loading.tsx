import { LoadingState } from "@/components/states";

/** Единый loading-экран сегмента /dashboard (тикет 01). */
export default function DashboardLoading() {
  return <LoadingState label="Загрузка рабочего стола…" />;
}
