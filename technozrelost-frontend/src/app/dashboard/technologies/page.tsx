"use client";

import Link from "next/link";
import * as React from "react";
import { useMemo, useState } from "react";

import { FilterBar } from "@/features/registry/FilterBar";
import { RegistryCard } from "@/features/registry/RegistryCard";
import { RegistryGrid } from "@/features/registry/RegistryGrid";
import { RegistryTable } from "@/features/registry/RegistryTable";
import { RegistryViewToggle } from "@/features/registry/RegistryViewToggle";
import { useRegistryView } from "@/features/registry/useRegistryView";
import { useFavorites } from "@/features/registry/favorites";
import { useRegistry } from "@/features/registry/useRegistry";
import { ExportButton } from "@/features/registry/export";

/**
 * Реестр технологий — проекция проектов с УГТ 7+ (тикет 04, R20, G13, G14, G24).
 * Берёт `projects/registry?ugt_min=7`, не GET /technologies.
 * Удалён мок CATEGORIES=["AI/ML","НИОКТР"], бюджет всем, сортировка по дате ↓,
 * дата 31.03.2027 + тултип «2 дня назад», мобилка 1 колонка + drawer, лимит 20.
 */
export default function TechnologiesPage() {
  // Проекты = технологии: технологии берём из projects/registry с ugt_min=7
  const registry = useRegistry({ registryKey: "technologies", initial: { ugt_min: 7 } });
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { isFav, toggle } = useFavorites("technologies");
  const [view, setView] = useRegistryView("technologies");

  const displayItems = useMemo(() => {
    let items = registry.items;
    // Гарантия: даже если бэк вернёт <7, фильтруем клиентски
    items = items.filter((p) => (p.current_level ?? 0) >= 7);
    if (favoritesOnly) items = items.filter((p) => isFav(p.id));
    return items;
  }, [registry.items, favoritesOnly, isFav]);

  return (
    <section data-registry="technologies">
      <div className="border-b border-tz-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="tz-eyebrow">Реестры платформы</p>
            <h1 className="tz-page-title mt-2">Реестр технологий</h1>
            <p className="mt-2 max-w-2xl text-tz-secondary">
              Технологии — это проекты с уровнем УГТ 7+ (ГОСТ Р 58048-2017). Источник — тот же
              реестр проектов с фильтром ugt_min=7. Бюджет виден всем.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RegistryViewToggle view={view} onChange={setView} />
            <ExportButton rows={displayItems} registryKey="technologies" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <FilterBar
            filters={registry.filters}
            setFilters={registry.setFilters}
            favoritesOnly={favoritesOnly}
            setFavoritesOnly={setFavoritesOnly}
            registryKey="technologies"
          />
          <p className="mt-3 text-xs text-tz-muted">Фильтр УГТ 7+ применён по умолчанию. Делитесь ссылкой — фильтры в URL.</p>
        </div>

        <div>
          {view === "cards" ? (
            <RegistryGrid
              items={displayItems}
              loading={registry.loading}
              error={registry.error}
              errorStatus={registry.errorStatus}
              onRetry={registry.refresh}
              hasMore={favoritesOnly ? false : registry.hasMore}
              onLoadMore={registry.loadMore}
              loadingMore={registry.loadingMore}
              renderCard={(project) => (
                <RegistryCard
                  project={project}
                  href={`/dashboard/project/${project.id}`}
                  isFavorite={isFav(project.id)}
                  onToggleFavorite={() => toggle(project.id)}
                />
              )}
              emptyTitle={favoritesOnly ? "Нет избранных технологий" : "Технологий УГТ 7+ пока нет"}
              emptyDescription={
                favoritesOnly
                  ? "Отметьте технологии звёздочкой."
                  : "Технология попадает в этот реестр автоматически при подтверждении уровня УГТ 7 и выше."
              }
              emptyAction={
                favoritesOnly ? (
                  <button type="button" onClick={() => setFavoritesOnly(false)} className="tz-btn tz-btn-secondary">
                    Показать все
                  </button>
                ) : (
                  <Link href="/dashboard/projects" className="tz-btn tz-btn-secondary">
                    К реестру проектов
                  </Link>
                )
              }
            />
          ) : (
            <RegistryTable
              items={displayItems}
              loading={registry.loading}
              error={registry.error}
              errorStatus={registry.errorStatus}
              onRetry={registry.refresh}
              hasMore={favoritesOnly ? false : registry.hasMore}
              onLoadMore={registry.loadMore}
              loadingMore={registry.loadingMore}
              isFavorite={isFav}
              onToggleFavorite={toggle}
              getHref={(project) => `/dashboard/project/${(project as unknown as { id: number }).id}`}
              emptyTitle={favoritesOnly ? "Нет избранных технологий" : "Технологий УГТ 7+ пока нет"}
              emptyDescription={
                favoritesOnly
                  ? "Отметьте технологии звёздочкой."
                  : "Технология попадает в этот реестр автоматически при подтверждении уровня УГТ 7 и выше."
              }
              emptyAction={
                favoritesOnly ? (
                  <button type="button" onClick={() => setFavoritesOnly(false)} className="tz-btn tz-btn-secondary">
                    Показать все
                  </button>
                ) : (
                  <Link href="/dashboard/projects" className="tz-btn tz-btn-secondary">
                    К реестру проектов
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
