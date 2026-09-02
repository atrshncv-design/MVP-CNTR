"use client";

/**
 * Избранное реестров — localStorage (тикет 04, R24.1, G14).
 * Почему отдельный модуль: избранное per-реестр изолируется ключом
 * `tz:favorites:{registry}`, синхронизируется между вкладками через storage
 * event, не уходит на бэк (P1 — только локально, серверные сохранённые
 * фильтры — P2). Тест: звезда → localStorage.
 */

export const FAVORITES_PREFIX = "tz:favorites:";

export function favoritesKey(registry: string): string {
  return `${FAVORITES_PREFIX}${registry}`;
}

export function getFavorites(registry: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(favoritesKey(registry));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  } catch {
    return [];
  }
}

export function isFavorite(registry: string, id: number): boolean {
  return getFavorites(registry).includes(id);
}

export function setFavorites(registry: string, ids: number[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(favoritesKey(registry), JSON.stringify(ids));
}

export function toggleFavorite(registry: string, id: number): number[] {
  const cur = getFavorites(registry);
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  setFavorites(registry, next);
  return next;
}

import * as React from "react";

export function useFavorites(registry: string) {
  const [favs, setFavs] = React.useState<number[]>(() => getFavorites(registry));

  // Синхронизация при смене registry и между вкладками
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация localStorage с состоянием при смене registry
    setFavs(getFavorites(registry));
    const onStorage = (e: StorageEvent) => {
      if (e.key === favoritesKey(registry)) setFavs(getFavorites(registry));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [registry]);

  const toggle = React.useCallback(
    (id: number) => {
      const next = toggleFavorite(registry, id);
      setFavs(next);
      return next;
    },
    [registry],
  );

  const isFav = React.useCallback((id: number) => favs.includes(id), [favs]);

  return { favs, toggle, isFav, hasFavs: favs.length > 0 };
}
