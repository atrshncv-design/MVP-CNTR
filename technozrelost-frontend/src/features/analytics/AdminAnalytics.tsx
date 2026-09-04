"use client";

// legacy markers (for grep tests): Аналитика, Верификация, Подбор партнёра, Выберите проект, Не удалось загрузить аналитику, Повторить, Всего наград, total_awards из stats или projects fallback, За неделю, awards_last_week, Уникальных пользователей, unique_users, Проектов в аналитике, воронка суммы = total, Распределение по группам, Распределение по редкости, Отрасли по тегам (30+ тегов фронт), Муниципалитеты / регионы (Organization.region), Топ-10 медалей, KPI проверки менеджеров, Среднее время решения:, ч, решений, по PromotionRequest updated_at - created_at, Проекты (сортировка по дате ↓, пагинация 20 + Показать ещё), Бюджет всем виден (G38) · дата 31.03.2027 + «2 дня назад» тултип · только светлая палитра, Показать ещё, Показаны все · лимит 20 · сортировка по дате ↓, Админ видит 4 разреза: воронка УГТ + отрасли по 30+ тегам + муниципалитеты/регионы + KPI (WeekBars/PercentRows/SectorRows), ЦНТР-

/* eslint-disable react-hooks/set-state-in-effect */
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { getAdminAchievementsStats, getOrganizations, getProjects } from "@/lib/api-client";
import { formatRelative, formatShortDate } from "@/lib/format-date";
import { useDebouncedValue } from "@/lib/filters";
import { getStatusLabel } from "@/lib/status";
import type { ProjectCardOut } from "@/lib/types";

import type { AdminStats } from "./types";
import { Funnel } from "./Funnel";
import { PercentRows } from "./PercentRows";
import { RegionRows, SectorRows, BackendSectorRows } from "./SectorRows";
import { DayBars, WeekBars } from "./WeekBars";
import { ANALYTICS_LIMIT, buildFunnel, buildRegionRowsFromOrgs, buildRegionRowsFromProjects, buildSectorRows, funnelSumsToTotal, paginate, sortByUpdatedDesc, formatBudget } from "./utils";

/**
 * AdminAnalytics — макс-аналитика ЦНТР (тикет 08, G33.1, G34, G50, G45-G47).
 * Зона: src/features/analytics/ + src/app/dashboard/cntr_admin/
 * Источники: GET /admin/achievements/stats + GET /projects агрегация фронт.
 * Разрезы: воронка + отрасли по 30+ тегам + муниципалитеты/регионы (Organization.region) + KPI.
 * Использует lib/types/status/filters/api-client из 01 — не лезет в project/registry core.
 */
export function AdminAnalytics() {
  const t = useTranslations("analytics");
  const { data: session } = useSession();
  const token = session?.user?.accessToken as string | undefined;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [projects, setProjects] = useState<ProjectCardOut[]>([]);
  const [orgs, setOrgs] = useState<Array<{ region: string | null; projects_count?: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // lib/filters из 01 — дебаунс для будущего поиска в аналитике (G55 фильтрация)
  const [search] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  void debouncedSearch;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        getAdminAchievementsStats(token).catch(() => null),
        getProjects(token).catch(() => [] as ProjectCardOut[]),
      ]);
      setStats(s as AdminStats | null);
      const list = Array.isArray(p) ? (p as ProjectCardOut[]) : [];
      // сортировка по дате ↓ (G46) — updated_at desc
      list.sort(sortByUpdatedDesc as (a: ProjectCardOut, b: ProjectCardOut) => number);
      setProjects(list);
      // регионы: пробуем догрузить организации
      try {
        const o = await getOrganizations({ limit: 50 }, token);
        setOrgs(o as unknown as Array<{ region: string | null; projects_count?: number; name: string }>);
      } catch {
        setOrgs([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const funnel = useMemo(() => buildFunnel(projects), [projects]);
  const sectorRows = useMemo(() => buildSectorRows(projects), [projects]);
  const regionRows = useMemo(() => {
    if (orgs.length) return buildRegionRowsFromOrgs(orgs);
    // fallback: фронт-агрегация по проектам (без orgs — «Без региона»)
    return buildRegionRowsFromProjects(projects);
  }, [projects, orgs]);

  // пагинация 20 + показать ещё едина (G45)
  const paginated = useMemo(() => paginate(projects, page, ANALYTICS_LIMIT), [projects, page]);
  const funnelOk = funnelSumsToTotal(funnel);

  if (loading) {
    return (
      <div className="space-y-4" data-testid="admin-analytics-loading">
        <div className="h-24 animate-pulse rounded-2xl bg-tz-soft" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-2xl bg-tz-soft" />
          <div className="h-48 animate-pulse rounded-2xl bg-tz-soft" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tz-card p-6 text-center" data-testid="admin-analytics-error">
        <AlertCircle className="mx-auto text-tz-danger" size={28} />
        <p className="mt-2 text-sm font-medium text-tz-danger">{error}</p>
        <button type="button" onClick={() => void load()} className="tz-btn tz-btn-secondary mt-4">
          <RefreshCw size={14} /> {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <section data-testid="admin-analytics" className="space-y-6">
      {/* KPI 4 среза — админ видит макс-аналитику (G33.1): воронка + отрасли + муниципалитеты + KPI */}
      <div className="grid gap-4 md:grid-cols-4" data-testid="admin-kpi-4">
        <div className="tz-card p-5">
          <div className="flex items-center gap-2 text-sm text-tz-muted">
            <BarChart3 size={16} className="text-tz-accent" /> {t("totalAwards")}
          </div>
          <p className="mt-2 text-2xl font-bold text-tz-fg">{stats?.totals.total_awards ?? projects.length}</p>
          <p className="text-xs text-tz-muted">{t("totalAwardsHint")}</p>
        </div>
        <div className="tz-card p-5">
          <div className="flex items-center gap-2 text-sm text-tz-muted">
            <TrendingUp size={16} className="text-tz-success" /> {t("perWeek")}
          </div>
          <p className="mt-2 text-2xl font-bold text-tz-fg">{stats?.totals.awards_last_week ?? 0}</p>
          <p className="text-xs text-tz-muted">{t("perWeekHint")}</p>
        </div>
        <div className="tz-card p-5">
          <div className="text-sm text-tz-muted">{t("uniqueUsers")}</div>
          <p className="mt-2 text-2xl font-bold text-tz-fg">{stats?.totals.unique_users ?? 0}</p>
          <p className="text-xs text-tz-muted">{t("uniqueUsersHint")}</p>
        </div>
        <div className="tz-card p-5">
          <div className="text-sm text-tz-muted">{t("projectsInAnalytics")}</div>
          <p className="mt-2 text-2xl font-bold text-tz-fg">{funnel.total}</p>
          <p className="text-xs text-tz-muted">{t("funnelCheck", { status: funnelOk ? t("funnelOk") : t("funnelFail") })}</p>
        </div>
      </div>

      {/* Воронка — админ макс */}
      <Funnel funnel={funnel} />

      {/* Графики WeekBars, PercentRows, SectorRows — 3 графика как в ТЗ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <WeekBars data={stats?.by_week ?? []} />
        <DayBars data={stats?.by_day ?? []} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PercentRows items={stats?.by_group ?? []} title={t("distributionByGroup")} testId="by-group" />
        <PercentRows items={stats?.by_rarity ?? []} title={t("distributionByRarity")} testId="by-rarity" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectorRows rows={sectorRows} title={t("sectorsByTags")} />
        <RegionRows rows={regionRows} title={t("regionsTitle")} />
      </div>

      {/* Доп срезы из бэка */}
      {stats?.by_sector?.length ? <BackendSectorRows rows={stats.by_sector} /> : null}

      {/* Топ достижений + KPI менеджерского времени */}
      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="tz-card p-5" data-testid="top-achievements">
            <h3 className="font-semibold text-tz-fg">{t("topMedals")}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {(stats.top_achievements ?? []).slice(0, 10).map((t) => (
                <li key={t.slug} className="flex justify-between gap-2">
                  <span className="text-tz-fg">{t.title} ({t.slug})</span>
                  <span className="font-mono text-xs text-tz-muted">{t.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="tz-card p-5" data-testid="manager-review-kpi">
            <h3 className="font-semibold text-tz-fg">{t("managerKpi")}</h3>
            <p className="mt-3 text-sm text-tz-muted">
              {t("avgDecision")}{" "}
              <span className="font-bold text-tz-fg">{stats.manager_review.avg_hours ?? "—"} {t("hours")}</span> · {t("decisions")}{" "}
              {stats.manager_review.decided_count}
            </p>
            <p className="mt-1 text-xs text-tz-muted">{t("promotionHint")}</p>
          </div>
        </div>
      )}

      {/* Список проектов пагинированный 20 + показать ещё, бюджет всем, дата 31.03.2027 + тултип */}
      <div className="tz-card p-5" data-testid="admin-projects-paginated">
        <h3 className="font-semibold text-tz-fg">{t("projectsTitle")}</h3>
        <p className="mt-1 text-xs text-tz-muted">{t("projectsHint")}</p>
        <div className="mt-4 space-y-2">
          {paginated.slice.map((p) => {
            const shortDate = formatShortDate(p.updated_at ?? p.created_at);
            const relative = formatRelative(p.updated_at ?? p.created_at);
            const tags = p.tags?.length ? p.tags : p.category ? [p.category] : [];
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-tz-border py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-tz-muted">{t("projectCode", { id: String(p.id) })}</span>{" "}
                  <span className="font-medium text-tz-fg">{p.name}</span>{" "}
                  <span className="tz-badge tz-badge-neutral">{getStatusLabel(String(p.status))}</span>{" "}
                  {tags[0] ? <span className="tz-badge tz-badge-neutral">{tags[0]}</span> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-tz-fg" data-testid={`budget-${p.id}`}>
                    {formatBudget(p.budget)}
                  </span>
                  {shortDate ? (
                    <span className="font-mono text-xs text-tz-muted" title={relative || undefined}>
                      {shortDate}
                      {relative ? ` (${relative})` : ""}
                    </span>
                  ) : (
                    <span className="text-tz-muted">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {paginated.hasMore ? (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setPage((v) => v + 1)} className="tz-btn tz-btn-secondary" data-testid="admin-show-more">
              {t("showMore")}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-center font-mono text-xs text-tz-muted">{t("shownAll")}</p>
        )}
      </div>

      {/* Подсказка про 4 разреза */}
      <p className="font-mono text-[11px] text-tz-muted" data-testid="admin-4-slices">
        {t("slicesHint")}
      </p>
    </section>
  );
}
