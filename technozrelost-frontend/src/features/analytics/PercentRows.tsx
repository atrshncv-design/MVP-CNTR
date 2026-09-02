"use client";

import type { StatsGroupItem } from "./types";

/**
 * PercentRows — распределение по группам/редкости (тикет 08).
 * Почему строки с процентами: by_group / by_rarity из GET /admin/achievements/stats.
 * Использует только светлую палитру, без тёмной (G48).
 */
export function PercentRows({
  items,
  title,
  testId = "percent-rows",
}: {
  items: StatsGroupItem[];
  title: string;
  testId?: string;
}) {
  return (
    <div className="tz-card p-5" data-testid={testId}>
      <h3 className="font-semibold text-tz-fg">{title}</h3>
      <p className="mt-1 text-xs text-tz-muted">Доля от total_awards</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-tz-muted">Данных пока нет</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((it) => (
            <div key={it.key} data-testid={`percent-row-${it.key}`} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-tz-fg">{it.key}</span>
                <span className="font-mono text-xs text-tz-muted">
                  {it.count} · {it.percent}%
                </span>
              </div>
              <div className="tz-progress h-2">
                <div className="tz-progress-fill" style={{ width: `${it.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
