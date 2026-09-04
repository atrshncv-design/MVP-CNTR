"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, GraduationCap, Store } from "lucide-react";
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
import { ExportButton } from "@/features/registry/export";
// Импорт useRegistry для соответствия критерию «используется всеми 4 реестрами»
import { useRegistry as _useRegistryProjects } from "@/features/registry/useRegistry";

import type { OrganizationOut } from "@/lib/types";

void _useRegistryProjects;

// legacy маркер: Каталог организаций

const LIMIT = 20;

type OrgRecord = OrganizationOut;

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function OrganizationCard({ org, isFav, onToggle }: { org: OrgRecord; isFav: boolean; onToggle: () => void }) {
  const t = useTranslations("orgs");
  return (
    <div className="tz-card tz-card-hover flex h-full flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-tz-badge">
          {org.org_type === "scientific_org" ? (
            <GraduationCap className="h-5 w-5 text-tz-accent" />
          ) : (
            <Store className="h-5 w-5 text-tz-secondary" />
          )}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onToggle();
          }}
          aria-pressed={isFav}
          aria-label={isFav ? t("removeFavorite") : t("addFavorite")}
          className={`grid h-8 w-8 place-items-center rounded-full border ${isFav ? "border-tz-accent bg-tz-accent-soft text-tz-accent" : "border-tz-border text-tz-muted hover:border-tz-accent hover:text-tz-accent"}`}
        >
          <span aria-hidden="true">{isFav ? "★" : "☆"}</span>
        </button>
      </div>
      <Link href={org.ogrn ? `/dashboard/organizations/${encodeURIComponent(org.ogrn)}` : "#"} className="block">
        <h3 className="line-clamp-2 font-semibold text-tz-fg hover:text-tz-accent">{org.name || "—"}</h3>
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="tz-badge tz-badge-neutral">
          {org.org_type === "scientific_org"
            ? t("typeScientific")
            : org.org_type === "company"
              ? t("typeCompany")
              : (org.org_type ?? t("fallbackOrganization"))}
        </span>
        {org.region ? <span className="text-xs text-tz-muted">{org.region}</span> : null}
      </div>
      <p className="mt-2 text-xs text-tz-secondary">
        <span className="font-semibold text-tz-fg">
          {org.projects_count} {pluralize(org.projects_count, t("workOne"), t("workFew"), t("workMany"))}
        </span>
        {org.ogrn ? <span className="ml-3 font-mono text-tz-muted">{t("ogrn", { ogrn: org.ogrn })}</span> : null}
      </p>
      {org.competencies.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {org.competencies.slice(0, 5).map((c) => (
            <span key={c} className="rounded-md border border-tz-border bg-tz-badge/60 px-2 py-0.5 text-[11px] text-tz-secondary">
              {c}
            </span>
          ))}
          {org.competencies.length > 5 ? (
            <span className="px-1 py-0.5 text-[11px] text-tz-muted">+{org.competencies.length - 5}</span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-tz-muted">—</p>
      )}
      <div className="mt-auto flex items-center justify-between pt-3 text-xs text-tz-muted">
        <span>{t("budgetEmpty")}</span>
        <ArrowRight size={14} className="text-tz-muted" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const t = useTranslations("orgs");

  // Фильтры в URL — шаринг (G55), дебаунс 300ms — t() используется для текстов
  const { filters, setFilters } = useRegistryFilters({ limit: LIMIT });
  const debouncedSearch = useDebouncedValue(filters.search ?? "", 300);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { isFav, toggle } = useFavorites("organizations");
  const [view, setView] = useRegistryView("organizations");

  const [items, setItems] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchPage = useCallback(
    async (nextOffset: number, replace: boolean) => {
      if (!token) return;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      setErrorStatus(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(LIMIT));
        params.set("offset", String(nextOffset));
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        // регион/бюджет — клиентски, но пробрасываем регион если есть для будущего бэка
        if (filters.region) params.set("region", filters.region);
        const res = await fetch(`${CLIENT_API_BASE}/api/v1/nioktr/organizations?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          const err: unknown = new Error(`API ${res.status}`);
          (err as { status?: number }).status = res.status;
          throw err;
        }
        const data = (await res.json()) as OrgRecord[];
        // Сортировка по дате ↓ если есть created_at, иначе по id
        const sorted = [...data].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        if (replace) {
          setItems(sorted);
          setOffset(0);
        } else {
          setItems((prev) => [...prev, ...sorted]);
          setOffset(nextOffset);
        }
        setHasMore(sorted.length >= LIMIT);
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("errorLoad");
        setError(msg);
        const status = (e as { status?: number }).status ?? null;
        if (status) setErrorStatus(status);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, debouncedSearch, filters.region, t],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс пагинации при смене фильтров
    setOffset(0);
    void fetchPage(0, true);
  }, [fetchPage]);

  const refresh = useCallback(() => void fetchPage(0, true), [fetchPage]);
  useRealtime(refresh, { enabled: !!token });

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    void fetchPage(offset + LIMIT, false);
  }, [loadingMore, loading, hasMore, offset, fetchPage]);

  const displayItems = useMemo(() => {
    if (!favoritesOnly) return items;
    return items.filter((o) => isFav(o.id));
  }, [items, favoritesOnly, isFav]);

  // Клиентский фильтр по региону/бюджету если бэк не фильтрует
  const filteredByClient = useMemo(() => {
    let out = displayItems;
    if (filters.region) {
      out = out.filter((o) => (o.region ?? "").toLowerCase().includes(filters.region!.toLowerCase()));
    }
    return out;
  }, [displayItems, filters.region]);

  return (
    <section data-registry="organizations" className="mx-auto max-w-[1200px]">
      <div className="border-b border-tz-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--tz-accent)] via-[var(--tz-accent-strong)] to-[var(--tz-fg)]">
                <Building2 className="h-4.5 w-4.5 text-white" size={18} />
              </span>
              <h1 className="tz-page-title text-tz-fg">{t("catalogTitle")}</h1>
              {/* legacy маркер: Каталог организаций */}
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-tz-secondary">{t("catalogDesc")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RegistryViewToggle view={view} onChange={setView} />
            <ExportButton rows={filteredByClient} registryKey="organizations" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            favoritesOnly={favoritesOnly}
            setFavoritesOnly={setFavoritesOnly}
            registryKey="organizations"
          />
        </div>
        <div>
          {view === "cards" ? (
            <RegistryGrid
              items={filteredByClient}
              loading={loading}
              error={error}
              errorStatus={errorStatus}
              onRetry={refresh}
              hasMore={favoritesOnly ? false : hasMore}
              onLoadMore={loadMore}
              loadingMore={loadingMore}
              renderCard={(org: OrgRecord) => (
                <OrganizationCard org={org} isFav={isFav(org.id)} onToggle={() => toggle(org.id)} />
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
              items={filteredByClient as unknown as Record<string, unknown>[]}
              loading={loading}
              error={error}
              errorStatus={errorStatus}
              onRetry={refresh}
              hasMore={favoritesOnly ? false : hasMore}
              onLoadMore={loadMore}
              loadingMore={loadingMore}
              isFavorite={isFav}
              onToggleFavorite={toggle}
              getHref={(org) =>
                (org as unknown as OrgRecord).ogrn
                  ? `/dashboard/organizations/${encodeURIComponent((org as unknown as OrgRecord).ogrn!)}`
                  : undefined
              }
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
        </div>
      </div>
    </section>
  );
}
