/**
 * T-006. Панель поиска/фильтров/сортировки реестра (Design.md §12.2
 * «search and filters»). URL-состояние: изменения пишутся в searchParams
 * (router.push), назад/вперёд и прямые ссылки восстанавливают состояние.
 *
 * Desktop: строка поиска + сортировка + ряд фильтров.
 * Mobile: строка поиска + кнопка «Фильтры» (bottom-sheet FilterSheet).
 *
 * Поле поиска не контролируется пропсами напрямую (иначе курсор прыгает
 * при серверном ре-рендере): локальный текст + debounce 450 мс.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { RegistryQueryState } from "./query-state.ts";
import {
  activeFilterCount,
  hasActiveFilters,
  patchRegistryHref,
  sortLabel,
} from "./query-state.ts";
import { FilterControls, FilterSheet } from "./filter-sheet.tsx";

export interface SearchToolbarProps {
  /** Базовый маршрут реестра (например "/research"). */
  base: string;
  /** Текущее состояние из URL (пропс серверной страницы). */
  state: RegistryQueryState;
  yearOptions: string[];
  typeOptions: string[];
}

export function SearchToolbar({
  base,
  state,
  yearOptions,
  typeOptions,
}: SearchToolbarProps) {
  const router = useRouter();
  const [text, setText] = useState(state.search);
  const [sheetOpen, setSheetOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Синхронизация при внешней навигации (назад/вперёд, прямые ссылки) */
  useEffect(() => {
    (async () => {
      setText(state.search);
    })();
  }, [state.search]);

  /* Сброс debounce при размонтировании */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const commit = (patch: Partial<RegistryQueryState>) => {
    router.push(patchRegistryHref(base, state, patch));
  };

  const onSearchChange = (value: string) => {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim() !== state.search) commit({ search: value.trim() });
    }, 450);
  };

  const onSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit({ search: text.trim() });
  };

  const resetAll = () => {
    router.push(base);
  };

  const filterCount = activeFilterCount(state);
  const hasQuery = state.search !== "" || hasActiveFilters(state);

  return (
    <div className="space-y-3">
      <form
        onSubmit={onSearchSubmit}
        role="search"
        aria-label="Поиск по реестру НИОКТР"
        className="flex items-stretch gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={text}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Название, ключевые слова, исполнитель, № рег. — например «искусственный интеллект»"
            aria-label="Поиск по реестру НИОКТР"
            className="h-12 w-full rounded-control border border-subtle bg-surface pl-10 pr-4 text-body text-primary placeholder:text-muted transition-colors hover:border-strong focus:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          />
        </div>

        {/* Сортировка (desktop) */}
        <label className="hidden shrink-0 items-center gap-2 lg:flex">
          <span className="text-small text-muted">Сортировка:</span>
          <select
            value={state.sort}
            onChange={(event) => commit({ sort: event.target.value })}
            aria-label="Сортировка результатов"
            className="h-12 rounded-control border border-subtle bg-surface px-3 text-small text-primary transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <option value="created_date_desc">Сначала новые</option>
            <option value="created_date_asc">Сначала старые</option>
            <option value="name_asc">По названию (А–Я)</option>
            <option value="name_desc">По названию (Я–А)</option>
          </select>
        </label>

        {/* Кнопка фильтров (mobile) */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={`Открыть фильтры${filterCount > 0 ? `, активно: ${filterCount}` : ""}`}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-control border border-subtle bg-surface px-3.5 text-small font-medium text-primary transition-colors hover:border-strong lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span>Фильтры</span>
          {filterCount > 0 ? (
            <span className="rounded-[6px] bg-accent-soft px-1.5 py-0.5 text-meta font-medium text-accent">
              {filterCount}
            </span>
          ) : null}
        </button>

        {hasQuery ? (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-control px-3 text-small font-medium text-secondary transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Сбросить</span>
          </button>
        ) : null}
      </form>

      {/* Ряд фильтров (desktop) */}
      <div className="hidden lg:block">
        <FilterControls
          state={state}
          onPatch={commit}
          yearOptions={yearOptions}
          typeOptions={typeOptions}
        />
      </div>

      {/* Активные условия (mobile, краткая сводка) */}
      {hasQuery ? (
        <p className="flex flex-wrap items-center gap-2 text-meta text-muted lg:hidden">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          {state.search ? (
            <span>
              Поиск: <strong className="font-medium text-secondary">{state.search}</strong>
            </span>
          ) : null}
          {state.filters.year ? <span>· {state.filters.year}</span> : null}
          {state.filters.nioktr_types ? <span>· {state.filters.nioktr_types}</span> : null}
          {state.filters.is_ai_area ? <span>· тематика ИИ</span> : null}
          {state.filters.is_ai_usage ? <span>· использование ИИ</span> : null}
          <span>
            · сортировка: <strong className="font-medium text-secondary">{sortLabel(state.sort)}</strong>
          </span>
        </p>
      ) : null}

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPatch={commit}
        state={state}
        yearOptions={yearOptions}
        typeOptions={typeOptions}
      />
    </div>
  );
}
