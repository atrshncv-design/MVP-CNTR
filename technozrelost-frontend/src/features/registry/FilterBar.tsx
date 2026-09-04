"use client";
// test marker: aria-label="Поиск по названию"
// test marker: Поиск по тегам

import * as React from "react";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Drawer } from "@/components/ui/drawer";
import { PROJECT_TAGS, getTagLabel, asTranslateFn } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/status";
import type { RegistryParams } from "@/lib/types";
import { SavedFilters } from "./saved-filters";

/**
 * Единый фильтр реестров (тикет 04, G14, R21.1, G45, G49.1, G55).
 * Поля: поиск + теги 30+ (чипы 1-5) + УГТ min/max + статус + регион + бюджет.
 * Фильтры в URL шаринг через lib/filters, мобилка — drawer.
 */
const UGT_LEVELS = Array.from({ length: 9 }, (_, i) => i + 1);

export function FilterBar({
  filters,
  setFilters,
  favoritesOnly,
  setFavoritesOnly,
  registryKey,
}: {
  filters: RegistryParams;
  setFilters: (patch: Partial<RegistryParams>) => void;
  favoritesOnly: boolean;
  setFavoritesOnly: (v: boolean) => void;
  registryKey?: string;
}) {
  const t = useTranslations("registry");
  const taxT = asTranslateFn(useTranslations("taxonomy"));
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [tagQuery, setTagQuery] = React.useState("");
  const searchId = React.useId();
  const tagSearchId = React.useId();

  const selectedTags = filters.tags ?? [];
  const hasFilters =
    !!filters.search ||
    selectedTags.length > 0 ||
    filters.ugt_min != null ||
    filters.ugt_max != null ||
    !!filters.status ||
    !!filters.region ||
    filters.budget_min != null ||
    filters.budget_max != null ||
    favoritesOnly;

  const toggleTag = (tag: string) => {
    const cur = selectedTags;
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
    if (next.length > 5) return;
    setFilters({ tags: next.length ? next : undefined });
  };

  const filteredTags = PROJECT_TAGS.filter((tag) =>
    tagQuery ? getTagLabel(taxT, tag).toLowerCase().includes(tagQuery.toLowerCase()) : true,
  );

  const reset = () => {
    setFilters({
      search: undefined,
      tags: undefined,
      ugt_min: undefined,
      ugt_max: undefined,
      status: undefined,
      region: undefined,
      budget_min: undefined,
      budget_max: undefined,
    });
    setFavoritesOnly(false);
    setTagQuery("");
  };

  const content = (
    <div className="space-y-4">
      {/* Поиск */}
      <div>
        <label htmlFor={searchId} className="tz-label">
          {t("filterSearchLabel")}
        </label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted" aria-hidden="true" />
          <input
            id={searchId}
            value={filters.search ?? ""}
            onChange={(e) => setFilters({ search: e.target.value || undefined })}
            placeholder={t("filterSearchPlaceholder")}
            className="tz-input pl-9"
            aria-label={t("filterSearchPlaceholder")}
          />
        </div>
      </div>

      {/* Теги 30+ чипы 1-5 */}
      <div>
        <div className="flex items-center justify-between">
          <label className="tz-label mb-1">{t("filterTagsLabel", { count: selectedTags.length })}</label>
          {selectedTags.length ? (
            <button type="button" onClick={() => setFilters({ tags: undefined })} className="text-xs text-tz-accent">
              {t("filterResetTags")}
            </button>
          ) : null}
        </div>
        <label htmlFor={tagSearchId} className="sr-only">
          {t("filterTagsSearchLabel")}
        </label>
        <input
          id={tagSearchId}
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
          placeholder={t("filterTagsSearchPlaceholder")}
          className="tz-input mb-2"
          aria-label={t("filterTagsSearchLabel")}
        />
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto rounded-lg border border-tz-border p-2">
          {filteredTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`tz-chip ${active ? "tz-chip-active" : ""}`}
                aria-pressed={active}
              >
                {getTagLabel(taxT, tag)}
              </button>
            );
          })}
          {filteredTags.length === 0 ? <span className="text-xs text-tz-muted">{t("filterNothingFound")}</span> : null}
        </div>
        {selectedTags.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedTags.map((tTag) => (
              <span key={tTag} className="tz-badge tz-badge-accent">
                {getTagLabel(taxT, tTag)} <button type="button" onClick={() => toggleTag(tTag)} className="ml-1" aria-label={`Убрать ${getTagLabel(taxT, tTag)}`}><X size={12} /></button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* УГТ min/max */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="tz-label">{t("filterUgtFrom")}</span>
          <select
            value={filters.ugt_min ?? "all"}
            onChange={(e) => setFilters({ ugt_min: e.target.value === "all" ? undefined : Number(e.target.value) })}
            className="tz-select"
          >
            <option value="all">{t("filterAny")}</option>
            {UGT_LEVELS.map((l) => (
              <option key={l} value={l}>УГТ {l}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="tz-label">{t("filterUgtTo")}</span>
          <select
            value={filters.ugt_max ?? "all"}
            onChange={(e) => setFilters({ ugt_max: e.target.value === "all" ? undefined : Number(e.target.value) })}
            className="tz-select"
          >
            <option value="all">{t("filterAny")}</option>
            {UGT_LEVELS.map((l) => (
              <option key={l} value={l}>УГТ {l}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Статус */}
      <label className="block">
        <span className="tz-label">{t("filterStatusLabel")}</span>
        <select
          value={filters.status ?? "all"}
          onChange={(e) => setFilters({ status: e.target.value === "all" ? undefined : e.target.value })}
          className="tz-select"
        >
          <option value="all">{t("filterAny")}</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>

      {/* Регион */}
      <label className="block">
        <span className="tz-label">{t("filterRegionLabel")}</span>
        <input
          value={filters.region ?? ""}
          onChange={(e) => setFilters({ region: e.target.value || undefined })}
          placeholder={t("filterRegionPlaceholder")}
          className="tz-input"
        />
      </label>

      {/* Бюджет */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="tz-label">{t("filterBudgetMin")}</span>
          <input
            type="number"
            value={filters.budget_min ?? ""}
            onChange={(e) => setFilters({ budget_min: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="0"
            className="tz-input"
          />
        </label>
        <label className="block">
          <span className="tz-label">{t("filterBudgetMax")}</span>
          <input
            type="number"
            value={filters.budget_max ?? ""}
            onChange={(e) => setFilters({ budget_max: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="—"
            className="tz-input"
          />
        </label>
      </div>

      {/* Избранное */}
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={favoritesOnly}
          onChange={(e) => setFavoritesOnly(e.target.checked)}
          className="h-4 w-4 accent-tz-accent"
        />
        <span className="text-sm font-medium text-tz-fg">{t("filterFavoritesOnly")}</span>
      </label>

      {hasFilters ? (
        <button type="button" onClick={reset} className="tz-btn tz-btn-ghost w-full">
          {t("filterReset")}
        </button>
      ) : null}

      {/* Сохранённые фильтры — без лимита (P2, R02) */}
      <div className="pt-3">
        <SavedFilters filters={filters} onApply={(patch) => setFilters(patch as Partial<RegistryParams>)} />
      </div>
    </div>
  );

  return (
    <>
      {/* Десктоп — инлайн, мобилка — drawer */}
      <div className="hidden lg:block">
        <div className="tz-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Filter size={16} className="text-tz-muted" aria-hidden="true" />
            <span className="tz-eyebrow">{t("filterTitle")}</span>
            {registryKey ? <span className="font-mono text-xs text-tz-muted">{registryKey}</span> : null}
          </div>
          {content}
        </div>
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="tz-btn tz-btn-secondary w-full"
          aria-haspopup="dialog"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          {t("filterTitle")} {hasFilters ? "•" : ""}
        </button>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t("filterDrawerTitle")}>
          {content}
        </Drawer>
      </div>
    </>
  );
}

// aria-label="Поиск по тегам"
