"use client";

import * as React from "react";
import { Clock, History, AlertTriangle } from "lucide-react";
import type { AuditTrailEntryOut } from "@/lib/types";

interface HistoryPanelProps {
  entries?: AuditTrailEntryOut[] | null;
  className?: string;
  /** Бейдж возврата G50 (подготавливаем, позже активен). */
  returnBadge?: string | null;
}

/**
 * HistoryPanel — история изменений, видна всем (G22).
 * Hard-gate: при No-Go/rejected — стрелка назад timeline + бейдж «Возврат на УГТ N — Причина: …» (G50).
 */
export function HistoryPanel({ entries, className = "", returnBadge }: HistoryPanelProps) {
  const list = entries ?? [];
  const showReturnBadge = !!returnBadge;

  // Определяем rejected-события для стрелки назад timeline
  const isRejectedEntry = (e: AuditTrailEntryOut): boolean => {
    const action = (e.action ?? "").toLowerCase();
    const details = (e.details ?? {}) as Record<string, unknown>;
    const status = String(details["status"] ?? details["decision"] ?? "").toLowerCase();
    return action.includes("reject") || action.includes("rejected") || status === "rejected" || status === "no-go" || status === "no_go";
  };

  return (
    <section className={`tz-card p-6 ${className}`} data-testid="history-panel" aria-label="История изменений">
      <div className="flex items-center gap-2">
        <History size={18} className="text-tz-muted" />
        <h2 className="tz-card-title">История изменений</h2>
        <span className="tz-badge tz-badge-neutral">{list.length}</span>
      </div>
      <p className="mt-1 text-sm text-tz-muted">Лента AuditTrail видна всем участникам (G22).</p>

      {showReturnBadge && (
        <div
          data-testid="return-badge"
          className="mt-3 flex items-start gap-2 rounded-xl border border-tz-review bg-[var(--tz-review-soft)] px-4 py-3 text-sm font-semibold text-[var(--tz-review)]"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{returnBadge}</span>
        </div>
      )}

      {list.length === 0 ? (
        <p className="mt-4 text-sm text-tz-muted">История изменений пуста</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {list.map((entry) => {
            const rejected = isRejectedEntry(entry);
            return (
              <li
                key={entry.id}
                data-testid={`history-entry-${entry.id}`}
                data-rejected={rejected ? "true" : "false"}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${rejected ? "border-[var(--tz-review)] bg-[var(--tz-review-soft)]" : "border-tz-border bg-tz-bg"}`}
              >
                {rejected ? (
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tz-review)] text-white"
                    aria-hidden="true"
                    title="Возврат назад — No-Go"
                  >
                    ←
                  </span>
                ) : (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-tz-accent" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${rejected ? "text-[var(--tz-review)]" : "text-tz-fg"}`}>
                    {rejected ? `← ${entry.action}` : entry.action}
                    {rejected && <span className="tz-badge tz-badge-review ml-2">Возврат на УГТ — Причина указана в timeline</span>}
                  </p>
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <p className="mt-0.5 break-all font-mono text-xs text-tz-muted">{JSON.stringify(entry.details)}</p>
                  )}
                  {entry.created_at && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-tz-muted">
                      <Clock size={12} />
                      {new Date(entry.created_at).toLocaleString("ru-RU")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default HistoryPanel;
