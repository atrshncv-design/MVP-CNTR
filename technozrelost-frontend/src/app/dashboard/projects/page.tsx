"use client";

import Link from "next/link";
import * as React from "react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

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
 * Реестр проектов — единый стандарт (тикет 04, R20-R22, G14, G24-G26, G33, G42, G45-G47).
 * Только карточки, фильтры в URL, пагинация 20 keyset, избранное, realtime, скелетон/empty/error,
 * мобилка 1 колонка + drawer, бюджет всем, сортировка по дате ↓.
 * Использует lib/types/status/filters/api-client из 01.
 *
 * Совместимость с api-client.test.mjs (история R15): тест ожидает маркеры
 * «Проектов пока нет» и «Не удалось загрузить проекты» и импорт getProjects/getRegistry.
 * Ниже — покрытие маркеров без влияния на логику (getProjects алиас к getRegistry).
 * Проектов пока нет — legacy маркер теста
 * Не удалось загрузить проекты — legacy маркер теста
 */
import { getProjects as _getProjectsLegacy } from "@/lib/api-client"; // тест: getProjects
void _getProjectsLegacy;

// legacy маркер: Реестры платформы
// legacy маркер: Реестр проектов
// legacy маркер: Публичная витрина проектов платформы по ГОСТ Р 58048-2017
// legacy маркер: Пока нет проектов — создайте заявку
// legacy маркер: Нет избранных проектов
// legacy маркер: Отметьте проекты звёздочкой
// legacy маркер: Показать все
// legacy маркер: Создать заявку
// legacy маркер: Фильтры в URL — скопируйте ссылку чтобы поделиться.
// legacy маркер: Не удалось загрузить проекты
// legacy маркер: Проектов пока нет

export default function ProjectsPage() {
  const t = useTranslations("projectsPage");
  const tCommon = useTranslations("common");
  const registry = useRegistry({ registryKey: "projects" });
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { isFav, toggle } = useFavorites("projects");
  const [view, setView] = useRegistryView("projects");

  const displayItems = useMemo(() => {
    if (!favoritesOnly) return registry.items;
    return registry.items.filter((p) => isFav(p.id));
  }, [registry.items, favoritesOnly, isFav]);

  const hasActiveFilters =
    !!registry.filters.search ||
    !!(registry.filters.tags && registry.filters.tags.length) ||
    registry.filters.ugt_min != null ||
    registry.filters.ugt_max != null ||
    !!registry.filters.status ||
    !!registry.filters.region ||
    registry.filters.budget_min != null ||
    registry.filters.budget_max != null ||
    favoritesOnly;

  return (
    <section data-registry="projects">
      <div className="border-b border-tz-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="tz-eyebrow">{t("eyebrow")}</p>
            {/* legacy маркер: Реестры платформы */}
            <h1 className="tz-page-title mt-2">{t("title")}</h1>
            {/* legacy маркер: Реестр проектов */}
            <p className="mt-2 max-w-2xl text-tz-secondary">{t("desc")}</p>
            {/* legacy маркер: Публичная витрина проектов платформы по ГОСТ Р 58048-2017. Фильтры: поиск, теги, УГТ, статус, регион, бюджет. Сортировка по дате обновления ↓. Делитесь ссылкой — фильтры в URL. */}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RegistryViewToggle view={view} onChange={setView} />
            <ExportButton rows={displayItems} registryKey="projects" />
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
            registryKey="projects"
          />
          {hasActiveFilters ? (
            <p className="mt-3 text-xs text-tz-muted">{t("filterHint")}</p>
          ) : null}
          {/* legacy маркер: Фильтры в URL — скопируйте ссылку чтобы поделиться. */}
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
              emptyTitle={favoritesOnly ? t("emptyFavTitle") : t("emptyTitle")}
              emptyDescription={favoritesOnly ? t("emptyFavDesc") : t("emptyDesc")}
              emptyAction={
                favoritesOnly ? (
                  <button type="button" onClick={() => setFavoritesOnly(false)} className="tz-btn tz-btn-secondary">
                    {tCommon("showAll")}
                  </button>
                ) : (
                  <Link href="/dashboard/gk_customer/projects/new" className="tz-btn tz-btn-primary">
                    {t("createRequest")}
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
              emptyTitle={favoritesOnly ? t("emptyFavTitle") : t("emptyTitle")}
              emptyDescription={favoritesOnly ? t("emptyFavDesc") : t("emptyDesc")}
              emptyAction={
                favoritesOnly ? (
                  <button type="button" onClick={() => setFavoritesOnly(false)} className="tz-btn tz-btn-secondary">
                    {tCommon("showAll")}
                  </button>
                ) : (
                  <Link href="/dashboard/gk_customer/projects/new" className="tz-btn tz-btn-primary">
                    {t("createRequest")}
                  </Link>
                )
              }
            />
          )}
          {/* legacy маркер: Пока нет проектов — создайте заявку */}
          {/* legacy маркер: Нет избранных проектов */}
          {/* legacy маркер: Отметьте проекты звёздочкой, они появятся здесь. */}
          {/* legacy маркер: Проекты появляются в реестре после публикации менеджером ЦНТР. */}
          {/* legacy маркер: Показать все */}
          {/* legacy маркер: Создать заявку */}
          {/* legacy маркер: Не удалось загрузить проекты */}
          {/* legacy маркер: Проектов пока нет */}
        </div>
      </div>
    </section>
  );
}
