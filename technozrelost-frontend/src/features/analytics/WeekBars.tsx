"use client";

import type { StatsPoint } from "./types";

/**
 * WeekBars — недельная/дневная динамика (тикет 08, G33.1).
 * Почему бары: динамика начислений по неделям/дням из GET /admin/achievements/stats.by_week / by_day.
 * Только светлая палитра (G48), без тёмной темы.
 */
export function WeekBars({
  data,
  title = "Динамика по неделям",
  testId = "week-bars",
}: {
  data: StatsPoint[];
  title?: string;
  testId?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="tz-card p-5" data-testid={testId}>
      <h3 className="font-semibold text-tz-fg">{title}</h3>
      <p className="mt-1 text-xs text-tz-muted">Начисления по ISO-неделям (понедельник → воскресенье)</p>
      <div className="mt-4 flex items-end gap-1.5" style={{ height: 88 }}>
        {data.map((pt) => {
          const h = Math.round((pt.count / max) * 72) + 8;
          const isZero = pt.count === 0;
          return (
            <div key={pt.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                data-testid={`week-bar-${pt.date}`}
                title={`${pt.date}: ${pt.count}`}
                className="w-full rounded-t-md transition-all"
                style={{
                  height: h,
                  background: isZero ? "var(--tz-border)" : "var(--tz-accent)",
                  opacity: isZero ? 0.5 : 1,
                }}
              />
              <span className="hidden font-mono text-[9px] text-tz-muted sm:block">
                {pt.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-tz-muted">
        <span>{data[0]?.date ?? "—"}</span>
        <span>{data[data.length - 1]?.date ?? "—"}</span>
      </div>
    </div>
  );
}

/** Дневные бары — тот же компонент, другой набор точек */
export function DayBars({ data }: { data: StatsPoint[] }) {
  return <WeekBars data={data} title="Динамика по дням (30 дней)" testId="day-bars" />;
}
