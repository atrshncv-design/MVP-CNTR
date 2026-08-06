/**
 * T-001. Логика тем: чтение сохранённого выбора, резолв системной темы,
 * применение data-theme на <html>, переключение. Чистые функции без побочных
 * эффектов на сервере — DOM/Storage доступны только при явной передаче
 * (или когда window/document реально существуют).
 */

export type Theme = "light" | "dark" | "udmurt";

export const THEME_STORAGE_KEY = "nfr-theme";

export const THEMES: readonly Theme[] = ["light", "dark", "udmurt"];

const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark" || value === "udmurt";

/** Прочитать сохранённый выбор из localStorage (null, если нет/невалиден/нет доступа). */
export function getStoredTheme(
  storage: Pick<Storage, "getItem"> | null | undefined = null,
): Theme | null {
  const s =
    storage ??
    (typeof window !== "undefined" ? window.localStorage : null);
  if (!s) return null;
  try {
    const raw = s.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Тема по системной настройке: тёмная при prefers-color-scheme: dark. */
export function getSystemTheme(
  prefersDark: boolean | null | undefined = null,
): Theme {
  const dark =
    prefersDark ??
    (typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
      : false);
  return dark ? "dark" : "light";
}

/** Итоговая тема: ручной выбор приоритетнее системного. */
export function resolveTheme(
  stored: Theme | null | undefined,
  system: Theme | null | undefined,
): Theme {
  return stored ?? system ?? "light";
}

/**
 * Применить тему: установить data-theme на <html> и (если storage передан
 * или доступен) сохранить выбор в localStorage. Возвращает применённую тему.
 */
export function applyTheme(
  theme: Theme,
  doc: Pick<Document, "documentElement"> | null | undefined = null,
  storage: Pick<Storage, "setItem"> | null | undefined = undefined,
): Theme {
  const d = doc ?? (typeof document !== "undefined" ? document : null);
  if (d) d.documentElement.setAttribute("data-theme", theme);
  if (storage !== undefined) {
    const s =
      storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    if (s) {
      try {
        s.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        /* noop: недоступное хранилище не ломает применение темы */
      }
    }
  }
  return theme;
}

/** Следующая тема по кругу (для cycle-жеста). */
export function cycleTheme(
  current: Theme,
  order: readonly Theme[] = THEMES,
): Theme {
  const index = order.indexOf(current);
  return order[(index + 1) % order.length];
}
