/**
 * Локальное хранение сохранённых фильтров — fallback при отсутствии бэка (P2, R02).
 * Почему отдельный модуль: бэкенд /filters/saved может отсутствовать (404) —
 * тогда используем localStorage с ключом `tz:saved-filters` без лимита.
 * Без лимита означает отсутствие truncate/slice — храним все записи.
 */

import type { RegistryParams } from "@/lib/types";
import type { SavedFilterOut } from "@/lib/api-client";

export const SAVED_FILTERS_KEY = "tz:saved-filters";

// Помогает пометить BLOCKED в отчёте — константа причины
export const BLOCKED_REASON = "BLOCKED: filters/saved — backend endpoint not available, localStorage fallback tz:saved-filters";

export type SavedFilter = SavedFilterOut;

function isValidSavedFilter(v: unknown): v is SavedFilter {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r["id"] !== "undefined" && typeof r["name"] === "string" && typeof r["filters"] === "object";
}

export function readLocalSavedFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_FILTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedFilter);
  } catch {
    return [];
  }
}

export function writeLocalSavedFilters(list: SavedFilter[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors — без лимита может упереться в лимит браузера, но не обрезаем молча
  }
}

/**
 * Добавление без лимита — просто push, не slice.
 * Почему без лимита: требование R02 «Без лимита».
 */
export function addLocalSavedFilter(name: string, filters: RegistryParams): SavedFilter {
  const list = readLocalSavedFilters();
  const now = new Date().toISOString();
  const entry: SavedFilter = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || `Фильтр ${list.length + 1}`,
    filters: { ...filters },
    created_at: now,
  };
  const next = [...list, entry];
  writeLocalSavedFilters(next);
  return entry;
}

export function removeLocalSavedFilter(id: string | number): SavedFilter[] {
  const list = readLocalSavedFilters();
  const next = list.filter((f) => String(f.id) !== String(id));
  writeLocalSavedFilters(next);
  return next;
}

export function clearLocalSavedFilters(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SAVED_FILTERS_KEY);
  } catch {
    // ignore
  }
}
