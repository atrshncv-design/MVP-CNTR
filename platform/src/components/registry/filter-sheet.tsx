/**
 * T-006. Мобильный bottom-sheet фильтров реестра (Design.md §8.3:
 * «preserve filter access through a bottom sheet»).
 *
 * Содержимое — общий набор контролов FilterControls, который же
 * используется на десктопе в search-toolbar (без дублирования).
 * Закрытие: оверлей, крестик, Escape, «Показать результаты».
 */

"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { RegistryQueryState } from "./query-state.ts";
import { activeFilterCount } from "./query-state.ts";
import { SORT_OPTIONS } from "./query-state.ts";

/* ------------------------------------------------------------------ */
/* Общие контролы фильтров (desktop-ряд и bottom-sheet)                */
/* ------------------------------------------------------------------ */

export interface FilterControlsProps {
  state: RegistryQueryState;
  /** Применить изменение (роутер обновит URL). */
  onPatch: (patch: Partial<RegistryQueryState>) => void;
  yearOptions: string[];
  typeOptions: string[];
}

const selectClasses =
  "h-10 rounded-control border border-subtle bg-surface px-2.5 text-small text-primary transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function FilterControls({
  state,
  onPatch,
  yearOptions,
  typeOptions,
}: FilterControlsProps) {
  const filters = state.filters;

  const setFilter = (key: keyof RegistryQueryState["filters"], value: string | undefined) => {
    const next = { ...filters };
    if (value === undefined || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onPatch({ filters: next });
  };

  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {/* Год */}
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-medium text-muted">
          Год
        </span>
        <select
          value={filters.year ?? ""}
          onChange={(event) => setFilter("year", event.target.value)}
          className={selectClasses}
        >
          <option value="">Все годы</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      {/* Тип работ */}
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-medium text-muted">
          Тип работ
        </span>
        <select
          value={filters.nioktr_types ?? ""}
          onChange={(event) => setFilter("nioktr_types", event.target.value)}
          className={selectClasses}
        >
          <option value="">Все типы</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {/* ИИ-фильтры */}
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="text-meta font-medium text-muted">
          Искусственный интеллект
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-small text-secondary">
            <input
              type="checkbox"
              checked={filters.is_ai_area === "true"}
              onChange={(event) =>
                setFilter("is_ai_area", event.target.checked ? "true" : undefined)
              }
              className="h-4 w-4 accent-[var(--accent-strong)]"
            />
            Тематика исследования — ИИ
          </label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-small text-secondary">
            <input
              type="checkbox"
              checked={filters.is_ai_usage === "true"}
              onChange={(event) =>
                setFilter("is_ai_usage", event.target.checked ? "true" : undefined)
              }
              className="h-4 w-4 accent-[var(--accent-strong)]"
            />
            В работе используется ИИ
          </label>
        </div>
      </fieldset>

      {/* Сортировка */}
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-meta font-medium text-muted">
          Сортировка
        </span>
        <select
          value={state.sort}
          onChange={(event) => onPatch({ sort: event.target.value })}
          className={selectClasses}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom-sheet                                                       */
/* ------------------------------------------------------------------ */

export interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<RegistryQueryState>) => void;
  state: RegistryQueryState;
  yearOptions: string[];
  typeOptions: string[];
}

export function FilterSheet({
  open,
  onClose,
  onPatch,
  state,
  yearOptions,
  typeOptions,
}: FilterSheetProps) {
  const [draft, setDraft] = useState<RegistryQueryState | null>(null);

  /* При открытии — рабочая копия; применяется только кнопкой. */
  useEffect(() => {
    (async () => {
      if (open) setDraft(state);
    })();
  }, [open, state]);

  /* Escape закрывает лист */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !draft) return null;

  const apply = () => {
    onPatch(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Оверлей */}
      <button
        type="button"
        aria-label="Закрыть фильтры"
        onClick={onClose}
        className="absolute inset-0 block h-full w-full cursor-default bg-overlay"
      />
      {/* Панель снизу */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Фильтры реестра"
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-panel border-t border-subtle bg-surface shadow-xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-subtle px-5">
          <span className="flex items-center gap-2 text-small font-semibold text-primary">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Фильтры
            {activeFilterCount(state) > 0 ? (
              <span className="rounded-[6px] bg-accent-soft px-1.5 py-0.5 text-meta font-medium text-accent">
                {activeFilterCount(state)}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть фильтры"
            className="inline-flex h-11 w-11 items-center justify-center rounded-control text-secondary transition-colors hover:bg-surface-elevated hover:text-primary"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FilterControls
            state={draft}
            onPatch={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
            yearOptions={yearOptions}
            typeOptions={typeOptions}
          />
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-subtle p-4">
          <button
            type="button"
            onClick={apply}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-control bg-accent-strong px-4 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Показать результаты
          </button>
        </div>
      </div>
    </div>
  );
}
