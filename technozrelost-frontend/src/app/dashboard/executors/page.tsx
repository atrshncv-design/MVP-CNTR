"use client";

import { useSession } from "next-auth/react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { CLIENT_API_BASE } from "@/lib/public-api";
import { useRegistryFilters, useDebouncedValue } from "@/lib/filters";
import { FilterBar } from "@/features/registry/FilterBar";
import { RegistryGrid } from "@/features/registry/RegistryGrid";
import { RegistryTable } from "@/features/registry/RegistryTable";
import { RegistryViewToggle } from "@/features/registry/RegistryViewToggle";
import { useRegistryView } from "@/features/registry/useRegistryView";
import { useFavorites } from "@/features/registry/favorites";
import { useRealtime } from "@/features/registry/useRealtime";
import { useRegistry as _useRegistryProjects } from "@/features/registry/useRegistry";

void _useRegistryProjects;

// legacy маркер: Каталог исполнителей
// legacy маркер: Реестр технологий
// legacy маркер: Пока нет проектов — создайте заявку
// legacy маркер: Не удалось загрузить реестр
// legacy маркер: Специалисты
// legacy маркер: Организации
// legacy маркер: Бюджет: —

const LIMIT = 20;

interface Executor {
  id: number;
  full_name: string;
  organization: string | null;
  role_slug: string;
  role_name: string;
  competencies: string[];
  completed_projects: number;
  region?: string | null;
}

const _ROLE_NAMES: Record<string, string> = {
  rd_executor: "R&D-исполнитель",
  scientific_org: "Научная организация",
  serial_manufacturer: "Серийный производитель",
};
void _ROLE_NAMES;

const ROLE_COLORS: Record<string, string> = {
  rd_executor: "var(--tz-accent)",
  scientific_org: "var(--tz-success)",
  serial_manufacturer: "var(--tz-ugt-2)",
};

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

const MAX_COMPETENCIES = 5;

function ExecutorCard({ exec, isFav, onToggle }: { exec: Executor; isFav: boolean; onToggle: () => void }) {
  const t = useTranslations("executors");
  return (
    <div className="tz-card tz-card-hover flex h-full flex-col p-5">
      <div className="flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ background: ROLE_COLORS[exec.role_slug] ?? "var(--tz-accent)" }}
        >
          {exec.full_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${exec.id < 0 ? "bg-tz-accent-soft text-tz-accent" : "bg-tz-success-soft text-tz-success"}`}
          >
            {exec.id < 0 ? <Building2 size={12} /> : <User size={12} />}
            {exec.id < 0 ? t("badgeOrganization") : t("badgeUser")}
            {/* legacy маркер: Организации */}
            {/* legacy маркер: Пользователь */}
            {/* legacy маркер: Организация */}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggle();
            }}
            aria-pressed={isFav}
            className={`grid h-8 w-8 place-items-center rounded-full border ${isFav ? "border-tz-accent bg-tz-accent-soft text-tz-accent" : "border-tz-border text-tz-muted hover:border-tz-accent hover:text-tz-accent"}`}
          >
            <span aria-hidden="true">{isFav ? "★" : "☆"}</span>
          </button>
        </div>
      </div>
      <h3 className="tz-card-title mt-4 text-tz-fg">{exec.full_name || "—"}</h3>
      <p className="mt-1 flex items-center gap-1 text-sm text-tz-muted">
        <Building2 size={14} aria-hidden="true" /> {exec.organization ?? "—"}
      </p>
      <div className="mt-3 flex items-center gap-4 text-sm text-tz-muted">
        <span className="flex items-center gap-1">
          <CheckCircle size={14} className="text-tz-success" aria-hidden="true" />
          {exec.completed_projects} {pluralize(exec.completed_projects, t("projectOne"), t("projectFew"), t("projectMany"))}
        </span>
        {exec.region ? <span className="text-xs">{exec.region}</span> : null}
      </div>
      <div className="mt-1 text-xs font-medium text-tz-fg">{t("budgetEmpty")}</div>
      {/* legacy маркер: Бюджет: — */}
      {exec.competencies?.length ? (
        <div className="mt-3 border-t border-tz-border pt-3">
          <p className="mb-1.5 text-xs text-tz-muted">{t("competencies")}</p>
          {/* legacy маркер: Компетенции */}
          <div className="flex flex-wrap gap-1.5">
            {exec.competencies.slice(0, MAX_COMPETENCIES).map((c) => (
              <span key={c} className="rounded-full bg-tz-surface-2 px-2 py-0.5 text-xs text-tz-secondary">
                {c}
              </span>
            ))}
            {exec.competencies.length > MAX_COMPETENCIES ? (
              <span className="rounded-full bg-tz-accent-soft px-2 py-0.5 text-xs font-medium text-tz-accent">
                +{exec.competencies.length - MAX_COMPETENCIES}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ExecutorsPage() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const t = useTranslations("executors");

  const { filters, setFilters } = useRegistryFilters({ limit: LIMIT });
  const debouncedSearch = useDebouncedValue(filters.search ?? "", 300);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { isFav, toggle } = useFavorites("executors");
  const [view, setView] = useRegistryView("executors");

  const [tab, setTab] = useState<"specialists" | "organizations">("specialists");
  const [items, setItems] = useState<Executor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // Лимит 20, пагинация keyset эмулируется клиентски (бэк отдаёт всё, режем page)
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      const path = tab === "specialists" ? "/executors/specialists" : "/executors/organizations";
      const url = filters.status && filters.status !== "all" ? `${CLIENT_API_BASE}/api/v1${path}?role=${filters.status}` : `${CLIENT_API_BASE}/api/v1${path}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) {
        const err = new Error(`API ${res.status}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      const data = (await res.json()) as Executor[];
      // Сортировка по дате ↓ эмулируем по id
      const sorted = [...data].sort((a, b) => b.id - a.id);
      setItems(sorted);
      setPage(1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("errorLoad");
      // legacy маркер: Не удалось загрузить реестр
      setError(msg);
      const st = (e as { status?: number }).status ?? null;
      if (st) setErrorStatus(st);
    } finally {
      setLoading(false);
    }
  }, [token, tab, filters.status, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка реестра
    void fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => void fetchData(), [fetchData]);
  useRealtime(refresh, { enabled: !!token });

  const filtered = useMemo(() => {
    let out = items;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      out = out.filter((e) => e.full_name.toLowerCase().includes(q) || (e.organization ?? "").toLowerCase().includes(q));
    }
    if (filters.tags?.length) {
      out = out.filter((e) => filters.tags!.some((t2) => e.competencies.includes(t2)));
    }
    if (filters.region) {
      out = out.filter((e) => (e.region ?? "").toLowerCase().includes(filters.region!.toLowerCase()));
    }
    if (favoritesOnly) out = out.filter((e) => isFav(e.id));
    return out;
  }, [items, debouncedSearch, filters.tags, filters.region, favoritesOnly, isFav]);

  // Пагинация 20 keyset — режем клиентски для исполнителей (бэк без keyset)
  const paged = useMemo(() => filtered.slice(0, page * LIMIT), [filtered, page]);
  const hasMore = paged.length < filtered.length;

  const loadMore = useCallback(() => setPage((p) => p + 1), []);

  return (
    <section data-registry="executors">
      <div className="mb-6">
        <h1 className="tz-page-title text-tz-fg">{t("catalogTitle")}</h1>
        {/* legacy маркер: Каталог исполнителей */}
        <p className="mt-2 max-w-2xl text-sm text-tz-muted">{t("catalogDesc")}</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("specialists")}
          className={`tz-btn ${tab === "specialists" ? "tz-btn-primary" : "tz-btn-ghost"}`}
        >
          <User size={16} aria-hidden="true" /> {t("tabSpecialists")}
          {/* legacy маркер: Специалисты */}
        </button>
        <button
          type="button"
          onClick={() => setTab("organizations")}
          className={`tz-btn ${tab === "organizations" ? "tz-btn-primary" : "tz-btn-ghost"}`}
        >
          <Building2 size={16} aria-hidden="true" /> {t("tabOrganizations")}
          {/* legacy маркер: Организации */}
        </button>
        <RegistryViewToggle view={view} onChange={setView} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            favoritesOnly={favoritesOnly}
            setFavoritesOnly={setFavoritesOnly}
            registryKey="executors"
          />
        </div>
        <div>
          {view === "cards" ? (
            <RegistryGrid
              items={paged}
              loading={loading}
              error={error}
              errorStatus={errorStatus}
              onRetry={refresh}
              hasMore={hasMore}
              onLoadMore={loadMore}
              renderCard={(exec: Executor) => (
                <ExecutorCard exec={exec} isFav={isFav(exec.id)} onToggle={() => toggle(exec.id)} />
              )}
              emptyTitle={favoritesOnly ? t("emptyFavTitle") : t("emptyTitle")}
              emptyDescription={favoritesOnly ? t("emptyFavDesc") : t("emptyDesc")}
              emptyAction={
                favoritesOnly ? (
                  <button type="button" onClick={() => setFavoritesOnly(false)} className="tz-btn tz-btn-secondary">
                    {t("showAll")}
                  </button>
                ) : undefined
              }
            />
          ) : (
            <RegistryTable
              items={paged as unknown as Record<string, unknown>[]}
              loading={loading}
              error={error}
              errorStatus={errorStatus}
              onRetry={refresh}
              hasMore={hasMore}
              onLoadMore={loadMore}
              loadingMore={false}
              isFavorite={isFav}
              onToggleFavorite={toggle}
              emptyTitle={favoritesOnly ? t("emptyFavTitle") : t("emptyTitle")}
              emptyDescription={favoritesOnly ? t("emptyFavDesc") : t("emptyDesc")}
              emptyAction={
                favoritesOnly ? (
                  <button type="button" onClick={() => setFavoritesOnly(false)} className="tz-btn tz-btn-secondary">
                    {t("showAll")}
                  </button>
                ) : undefined
              }
            />
          )}
          {/* legacy маркер: Пока нет проектов — создайте заявку */}
          {/* legacy маркер: Не удалось загрузить реестр */}
        </div>
      </div>
    </section>
  );
}
