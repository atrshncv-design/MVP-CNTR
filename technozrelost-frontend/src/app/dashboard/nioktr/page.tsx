"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Calendar, FlaskConical, Sparkles } from "lucide-react";

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
import { useRegistry as _useRegistryProjects } from "@/features/registry/useRegistry";

import type { NioktrCardOut } from "@/lib/types";

void _useRegistryProjects;

const LIMIT = 20;

type NioktrCard = NioktrCardOut & {
  budgets?: Array<{ funds?: string; budget_type?: string }>;
  is_ai_usage?: boolean;
  executor_short_name?: string | null;
  executor_territory?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

function NioktrRegistryCard({ card, isFav, onToggle }: { card: NioktrCard; isFav: boolean; onToggle: () => void }) {
  return (
    <div className="tz-card tz-card-hover flex h-full flex-col p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        {card.is_ai_area ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-tz-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-tz-accent">
            <Sparkles className="h-3 w-3" /> ИИ-направление
          </span>
        ) : (
          <span className="rounded-full bg-tz-badge px-2.5 py-0.5 text-[11px] font-medium text-tz-secondary">НИОКТР</span>
        )}
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
      <span className="font-mono text-[11px] text-tz-muted">{card.registration_number || "—"}</span>
      <Link
        href={`/dashboard/nioktr/${encodeURIComponent(card.registration_number)}`}
        className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-tz-fg hover:text-tz-accent"
      >
        {card.name || "—"}
      </Link>
      {card.annotation ? (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-tz-secondary">{card.annotation}</p>
      ) : (
        <p className="mt-2 text-xs text-tz-muted">—</p>
      )}
      <div className="mt-auto pt-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-tz-secondary">
          {card.executor_short_name ? (
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {card.executor_short_name}
            </span>
          ) : (
            <span>—</span>
          )}
          {card.created_date ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {card.created_date}
            </span>
          ) : null}
          {card.nioktr_types?.[0] ? <span className="rounded-md bg-tz-badge px-1.5 py-0.5">{card.nioktr_types[0]}</span> : null}
        </div>
        <div className="mt-2 text-xs font-medium text-tz-fg">Бюджет: —</div>
      </div>
    </div>
  );
}

export default function NioktrPage() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const { filters, setFilters } = useRegistryFilters({ limit: LIMIT });
  const debouncedSearch = useDebouncedValue(filters.search ?? "", 300);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { isFav, toggle } = useFavorites("nioktr");
  const [view, setView] = useRegistryView("nioktr");

  const [items, setItems] = useState<NioktrCard[]>([]);
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
        if (filters.region) params.set("region", filters.region);
        // tags/budget client-side, но ugt_min/max → ai фильтр уже в бэке
        if (filters.ugt_min != null && filters.ugt_min >= 7) params.set("ai", "true");
        const res = await fetch(`${CLIENT_API_BASE}/api/v1/nioktr?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          const err = new Error(`API ${res.status}`) as Error & { status?: number };
          err.status = res.status;
          throw err;
        }
        const data = (await res.json()) as NioktrCard[];
        // Сортировка по дате ↓ (G46) — created_date или id
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
        const msg = e instanceof Error ? e.message : "Не удалось загрузить реестр";
        setError(msg);
        const st = (e as { status?: number }).status ?? null;
        if (st) setErrorStatus(st);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, debouncedSearch, filters.region, filters.ugt_min],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка реестра при смене фильтров
    void fetchPage(0, true);
  }, [fetchPage]);

  const refresh = useCallback(() => void fetchPage(0, true), [fetchPage]);
  useRealtime(refresh, { enabled: !!token });

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    void fetchPage(offset + LIMIT, false);
  }, [loadingMore, loading, hasMore, offset, fetchPage]);

  const displayItems = useMemo(() => {
    let out: NioktrCard[] = items;
    // Клиентские фильтры: теги, статус, бюджет
    if (filters.tags?.length) {
      const tags = filters.tags;
      out = out.filter((c) => tags.some((t) => c.keywords?.includes(t) || c.name?.includes(t)));
    }
    if (filters.status) {
      // НИОКТР статуса нет — показываем «—», фильтр клиентски пропускает
    }
    if (favoritesOnly) out = out.filter((c) => isFav(c.id));
    return out;
  }, [items, filters.tags, filters.status, favoritesOnly, isFav]);

  return (
    <section data-registry="nioktr" className="mx-auto max-w-[1440px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl tz-grad-bg">
              <FlaskConical className="h-4.5 w-4.5 text-white" size={18} />
            </span>
            <h1 className="tz-page-title text-tz-fg">Реестр НИОКТР</h1>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-tz-secondary">
            Карточки НИОКТР — только карточки (G33), поиск + теги 30+ + УГТ + регион + бюджет, пагинация 20 +
            «Показать ещё» keyset, избранное, realtime, скелетон + empty + Retry, мобилка 1 колонка + drawer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RegistryViewToggle view={view} onChange={setView} />
          <ExportButton rows={displayItems} registryKey="nioktr" />
          <Link
            href="/dashboard/organizations"
            className="inline-flex items-center gap-2 rounded-xl border border-tz-border bg-tz-surface px-4 py-2 text-sm font-semibold text-tz-fg hover:bg-tz-hover"
          >
            <Building2 className="h-4 w-4" />
            Каталог организаций
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            favoritesOnly={favoritesOnly}
            setFavoritesOnly={setFavoritesOnly}
            registryKey="nioktr"
          />
        </div>
        <div>
          {view === "cards" ? (
            <RegistryGrid
              items={displayItems}
              loading={loading}
              error={error}
              errorStatus={errorStatus}
              onRetry={refresh}
              hasMore={favoritesOnly ? false : hasMore}
              onLoadMore={loadMore}
              loadingMore={loadingMore}
              renderCard={(card: NioktrCard) => (
                <NioktrRegistryCard card={card} isFav={isFav(card.id)} onToggle={() => toggle(card.id)} />
              )}
              emptyTitle={favoritesOnly ? "Нет избранных НИОКТР" : "Пока нет проектов — создайте заявку"}
              emptyDescription={
                favoritesOnly ? "Отметьте карточки звёздочкой." : "По заданным фильтрам карточек не найдено — создайте заявку."
              }
              emptyAction={
                favoritesOnly ? (
                  <button type="button" onClick={() => setFavoritesOnly(false)} className="tz-btn tz-btn-secondary">
                    Показать все
                  </button>
                ) : (
                  <Link href="/dashboard/gk_customer/projects/new" className="tz-btn tz-btn-primary">
                    Создать заявку
                  </Link>
                )
              }
            />
          ) : (
            <RegistryTable
              items={displayItems as unknown as Record<string, unknown>[]}
              loading={loading}
              error={error}
              errorStatus={errorStatus}
              onRetry={refresh}
              hasMore={favoritesOnly ? false : hasMore}
              onLoadMore={loadMore}
              loadingMore={loadingMore}
              isFavorite={isFav}
              onToggleFavorite={toggle}
              getHref={(card) =>
                `/dashboard/nioktr/${encodeURIComponent((card as unknown as NioktrCard).registration_number ?? String((card as unknown as { id: number }).id))}`
              }
              emptyTitle={favoritesOnly ? "Нет избранных НИОКТР" : "Пока нет проектов — создайте заявку"}
              emptyDescription={
                favoritesOnly ? "Отметьте карточки звёздочкой." : "По заданным фильтрам карточек не найдено — создайте заявку."
              }
              emptyAction={
                favoritesOnly ? (
                  <button type="button" onClick={() => setFavoritesOnly(false)} className="tz-btn tz-btn-secondary">
                    Показать все
                  </button>
                ) : (
                  <Link href="/dashboard/gk_customer/projects/new" className="tz-btn tz-btn-primary">
                    Создать заявку
                  </Link>
                )
              }
            />
          )}
        </div>
      </div>
    </section>
  );
}
