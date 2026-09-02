"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

import { getProjects } from "@/lib/api-client";
import { formatRelative, formatShortDate } from "@/lib/format-date";
import { getStatusLabel } from "@/lib/status";
import type { ProjectCardOut } from "@/lib/types";

import { Funnel } from "./Funnel";
import { ANALYTICS_LIMIT, buildFunnel, formatBudget, funnelSumsToTotal, paginate, sortByUpdatedDesc } from "./utils";

/**
 * ManagerAnalytics — урезанная аналитика менеджера ЦНТР (тикет 08).
 * Показывает: только очередь + 3 stat-cards + воронка по своим проектам.
 * Без отраслей/муниципалитетов (они только у админа).
 * Очередь верификации организаций остаётся (ProfileVerificationQueue в shell).
 */
export function ManagerAnalytics() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken as string | undefined;

  const [projects, setProjects] = useState<ProjectCardOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getProjects(token);
      const arr = Array.isArray(list) ? (list as ProjectCardOut[]) : [];
      arr.sort(sortByUpdatedDesc as (a: ProjectCardOut, b: ProjectCardOut) => number);
      setProjects(arr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить проекты");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const funnel = useMemo(() => buildFunnel(projects), [projects]);
  const paginated = useMemo(() => paginate(projects, page, ANALYTICS_LIMIT), [projects, page]);
  const funnelOk = funnelSumsToTotal(funnel);

  // 3 stat-cards для менеджера (без 4-го как у админа)
  const statCards = [
    { label: "Всего проектов (мои)", value: funnel.total },
    { label: "Активные", value: funnel.active },
    { label: "Черновики", value: funnel.draft + funnel.auto_confirmed },
  ];

  if (loading) {
    return (
      <div className="space-y-4" data-testid="manager-analytics-loading">
        <div className="h-20 animate-pulse rounded-2xl bg-tz-soft" />
        <div className="h-48 animate-pulse rounded-2xl bg-tz-soft" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="tz-card p-6 text-center" data-testid="manager-analytics-error">
        <AlertCircle className="mx-auto text-tz-danger" size={28} />
        <p className="mt-2 text-sm font-medium text-tz-danger">{error}</p>
        <button type="button" onClick={() => void load()} className="tz-btn tz-btn-secondary mt-4">
          <RefreshCw size={14} /> Повторить
        </button>
      </div>
    );
  }

  return (
    <section data-testid="manager-analytics" className="space-y-6">
      {/* 3 stat-cards — урезанная */}
      <div className="grid gap-4 md:grid-cols-3" data-testid="manager-3-stats">
        {statCards.map((c) => (
          <div key={c.label} className="tz-card p-5">
            <div className="text-sm text-tz-muted">{c.label}</div>
            <p className="mt-2 text-2xl font-bold text-tz-fg">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Воронка по своим проектам — единственный разрез у менеджера */}
      <Funnel funnel={funnel} title="Воронка по своим проектам (менеджер)" testId="manager-funnel" />

      {/* Очередь drafts/promotions — пагинированная */}
      <div className="tz-card p-5" data-testid="manager-queue">
        <div className="flex items-center gap-2">
          <Inbox size={16} className="text-tz-accent" />
          <h3 className="font-semibold text-tz-fg">Очередь: черновики и заявки на повышение УГТ</h3>
          <span className="tz-badge tz-badge-neutral">{projects.length}</span>
        </div>
        <p className="mt-1 text-xs text-tz-muted">Только проекты менеджера (membership), без отраслей/муниципалитетов · сумма воронки = total {funnelOk ? "✓" : "✗"}</p>

        <div className="mt-4 space-y-2">
          {paginated.slice.length === 0 ? (
            <p className="py-6 text-center text-sm text-tz-muted">Очередь пуста — нет проектов для модерации</p>
          ) : (
            paginated.slice.map((p) => {
              const shortDate = formatShortDate(p.updated_at ?? p.created_at);
              const relative = formatRelative(p.updated_at ?? p.created_at);
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-tz-border py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-tz-muted">ЦНТР-{p.id}</span>{" "}
                    <span className="font-medium text-tz-fg">{p.name}</span>{" "}
                    <span className="tz-badge tz-badge-neutral">{getStatusLabel(String(p.status))}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-tz-fg" data-testid={`budget-${p.id}`}>
                      {formatBudget(p.budget)}
                    </span>
                    {shortDate ? (
                      <span className="font-mono text-xs text-tz-muted" title={relative || undefined}>
                        {shortDate}
                      </span>
                    ) : (
                      <span className="text-tz-muted">—</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {paginated.hasMore ? (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setPage((v) => v + 1)} className="tz-btn tz-btn-secondary" data-testid="manager-show-more">
              Показать ещё
            </button>
          </div>
        ) : (
          <p className="mt-4 text-center font-mono text-[11px] text-tz-muted">Показаны все · лимит 20 · сортировка по дате ↓</p>
        )}
      </div>

      <p className="font-mono text-[11px] text-tz-muted" data-testid="manager-1-slice">
        Менеджер видит 1 разрез: воронка по своим проектам + очередь (без отраслей/муниципалитетов)
      </p>
    </section>
  );
}
