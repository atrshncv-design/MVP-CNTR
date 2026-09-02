"use client";

/**
 * UI сохранённых фильтров — без лимита (P2, R02, тикет 02).
 * Почему отдельный компонент: кнопка «Сохранить фильтр» → ввод имени →
 * список «Мои фильтры» → клик применяет, крестик удаляет, без лимита.
 * Использует useSavedFilters который скрывает бэк/localStorage.
 */

import * as React from "react";
import { Bookmark, Trash2, X } from "lucide-react";

import type { RegistryParams } from "@/lib/types";

import { useSavedFilters } from "./useSavedFilters";

export interface SavedFiltersProps {
  /** Текущие фильтры для сохранения */
  filters: RegistryParams;
  /** Применение сохранённого фильтра — прокидывает patch в useRegistry/setFilters */
  onApply: (filters: RegistryParams) => void;
}

export function SavedFilters({ filters, onApply }: SavedFiltersProps) {
  const { items, loading, error, isFallback, blockedReason, save, remove } = useSavedFilters();
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const created = await save(trimmed, filters);
      if (created) setName("");
    } finally {
      setSaving(false);
    }
  };

  const handleApply = (f: RegistryParams) => {
    onApply(f);
  };

  const handleDelete = async (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    await remove(id);
  };

  const hasFilters =
    !!filters.search ||
    !!(filters.tags && filters.tags.length) ||
    filters.ugt_min != null ||
    filters.ugt_max != null ||
    !!filters.status ||
    !!filters.region ||
    filters.budget_min != null ||
    filters.budget_max != null;

  return (
    <div className="tz-card p-4" data-testid="saved-filters">
      <div className="mb-3 flex items-center gap-2">
        <Bookmark size={16} className="text-tz-muted" aria-hidden="true" />
        <span className="tz-eyebrow">Сохранённые фильтры</span>
        {isFallback ? (
          <span
            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
            title={blockedReason ?? "BLOCKED: filters/saved"}
            data-testid="saved-filters-blocked"
          >
            local
          </span>
        ) : null}
      </div>

      {isFallback && blockedReason ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="saved-filters-blocked-reason">
          {blockedReason}
        </p>
      ) : null}

      {/* Сохранение — без лимита */}
      <div className="space-y-2">
        <label className="block">
          <span className="tz-label">Название фильтра</span>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
              placeholder="Например, УГТ 7+ Москва"
              className="tz-input flex-1"
              data-testid="saved-filters-input"
              aria-label="Имя фильтра"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="tz-btn tz-btn-secondary shrink-0 disabled:opacity-50"
              data-testid="saved-filters-save"
              aria-label="Сохранить фильтр"
            >
              {saving ? "Сохранение…" : "Сохранить фильтр"}
            </button>
          </div>
          {!hasFilters ? (
            <span className="mt-1 block text-xs text-tz-muted">Сохранит текущие фильтры (сейчас фильтры не заданы — сохранится пустой набор).</span>
          ) : null}
        </label>
      </div>

      {/* Список «Мои фильтры» — без лимита, клик применяет, крестик удаляет */}
      <div className="mt-4">
        <p className="tz-label mb-2">Мои фильтры {items.length ? `(${items.length})` : ""}</p>

        {loading ? (
          <p className="text-sm text-tz-muted" data-testid="saved-filters-loading">Загрузка…</p>
        ) : error ? (
          <p className="text-sm text-tz-danger" data-testid="saved-filters-error">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-tz-muted" data-testid="saved-filters-empty">Пока нет сохранённых фильтров — введите имя и нажмите «Сохранить фильтр».</p>
        ) : (
          <ul className="space-y-1.5" data-testid="saved-filters-list" aria-label="Мои фильтры">
            {items.map((f) => (
              <li
                key={String(f.id)}
                className="group flex items-center justify-between gap-2 rounded-lg border border-tz-border bg-tz-surface px-3 py-2 hover:border-tz-accent/30 hover:bg-tz-surface-2"
                data-testid="saved-filter-item"
              >
                <button
                  type="button"
                  onClick={() => handleApply(f.filters)}
                  className="flex-1 truncate text-left text-sm font-medium text-tz-fg hover:text-tz-accent"
                  title={`Применить фильтр: ${f.name}`}
                  data-testid="saved-filter-apply"
                  aria-label={`Применить фильтр ${f.name}`}
                >
                  <span className="block truncate">{f.name}</span>
                  <span className="block truncate text-xs font-normal text-tz-muted">
                    {describeFilters(f.filters)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => void handleDelete(f.id, e)}
                  className="shrink-0 rounded-md p-1.5 text-tz-muted hover:bg-tz-danger-soft hover:text-tz-danger"
                  aria-label={`Удалить фильтр ${f.name}`}
                  data-testid="saved-filter-delete"
                  title="Удалить"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* Подсказка без лимита */}
        {items.length > 0 ? (
          <p className="mt-2 text-xs text-tz-muted">Без лимита — сохранено {items.length}. Клик по фильтру применяет, крестик удаляет.</p>
        ) : null}
      </div>

      {items.length === 0 && !loading ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-tz-muted">
          <Trash2 size={12} aria-hidden="true" /> Удаление — крестик справа от фильтра.
        </p>
      ) : null}
    </div>
  );
}

function describeFilters(filters: RegistryParams): string {
  const parts: string[] = [];
  if (filters.search) parts.push(`поиск:${filters.search}`);
  if (filters.tags?.length) parts.push(`теги:${filters.tags.join(",")}`);
  if (filters.ugt_min != null || filters.ugt_max != null) parts.push(`УГТ ${filters.ugt_min ?? "—"}…${filters.ugt_max ?? "—"}`);
  if (filters.status) parts.push(`статус:${filters.status}`);
  if (filters.region) parts.push(`регион:${filters.region}`);
  if (filters.budget_min != null || filters.budget_max != null) parts.push(`бюджет ${filters.budget_min ?? "—"}…${filters.budget_max ?? "—"}`);
  if (!parts.length) return "без параметров";
  return parts.join(" · ");
}

export default SavedFilters;
