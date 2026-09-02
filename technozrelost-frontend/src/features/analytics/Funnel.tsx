"use client";

import { getStatusLabel } from "@/lib/status";
import type { FunnelData } from "./types";
import { funnelSumsToTotal } from "./utils";

/**
 * Funnel — воронка УГТ-статусов (тикет 08, G33.1, G34).
 * Статусы: draft → auto_confirmed → published → active → completed (+ rejected/archived отдельно).
 * Инвариант теста: сумма воронки = total проектов.
 */
export function Funnel({
  funnel,
  title = "Воронка УГТ — статусы проектов",
  testId = "funnel",
}: {
  funnel: FunnelData;
  title?: string;
  testId?: string;
}) {
  const linear: Array<{ key: keyof FunnelData; label: string }> = [
    { key: "draft", label: getStatusLabel("draft") },
    { key: "auto_confirmed", label: getStatusLabel("auto_confirmed") },
    { key: "published", label: getStatusLabel("published") },
    { key: "active", label: getStatusLabel("active") },
    { key: "completed", label: getStatusLabel("completed") },
  ];
  const max = Math.max(1, ...linear.map((s) => funnel[s.key] as number));
  const isValid = funnelSumsToTotal(funnel);

  return (
    <div className="tz-card p-5" data-testid={testId} data-total={funnel.total} data-valid={isValid ? "true" : "false"}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-tz-fg">{title}</h3>
        <span className="tz-badge tz-badge-neutral">Всего {funnel.total}</span>
      </div>
      <p className="mt-1 text-xs text-tz-muted">
        draft → auto_confirmed → published → active → completed · сумма = total {isValid ? "✓" : "✗"}
      </p>
      <div className="mt-4 space-y-2.5">
        {linear.map(({ key, label }) => {
          const count = funnel[key] as number;
          const width = funnel.total ? (count / funnel.total) * 100 : 0;
          const barWidth = max ? (count / max) * 100 : 0;
          return (
            <div key={key} data-testid={`funnel-${key}`} data-count={count} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-tz-fg">{label}</span>
                <span className="font-mono text-xs text-tz-muted">
                  {count} · {width.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-tz-soft">
                <div
                  className="h-2.5 rounded-full transition-all"
                  style={{
                    width: `${barWidth}%`,
                    background: key === "completed" ? "var(--tz-success)" : "var(--tz-accent)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {/* Ответвления rejected/archived отдельно, но входят в total для инварианта */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-tz-border pt-4 text-sm">
        <div data-testid="funnel-rejected" data-count={funnel.rejected} className="flex items-center justify-between">
          <span className="text-tz-muted">{getStatusLabel("rejected")}</span>
          <span className="tz-badge tz-badge-review">{funnel.rejected}</span>
        </div>
        <div data-testid="funnel-archived" data-count={funnel.archived} className="flex items-center justify-between">
          <span className="text-tz-muted">{getStatusLabel("archived")}</span>
          <span className="tz-badge tz-badge-neutral">{funnel.archived}</span>
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] text-tz-muted" data-testid="funnel-sum-check">
        Проверка: {funnel.draft}+{funnel.auto_confirmed}+{funnel.published}+{funnel.active}+{funnel.completed}+{funnel.rejected}+
        {funnel.archived}={funnel.draft + funnel.auto_confirmed + funnel.published + funnel.active + funnel.completed + funnel.rejected + funnel.archived}{" "}
        = total {funnel.total} {isValid ? "✓ сумма = total" : "✗ сумма ≠ total"}
      </p>
    </div>
  );
}
