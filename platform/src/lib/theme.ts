/**
 * Логика трёх тем (тикет 16): чистая, без JSX — тестируется напрямую.
 * Вынесена из components/theme-toggle.tsx.
 */
export type ThemeName = "light" | "dark" | "udmurt";

export const THEME_ORDER: ThemeName[] = ["light", "dark", "udmurt"];

const STORAGE_KEY = "tz-theme";

/** Читает сохранённую/системную тему (SSR-safe). */
export function getStoredTheme(
  storage: Pick<Storage, "getItem"> | null = null,
  matchDark: boolean = false,
): ThemeName {
  if (!storage) return "light";
  const stored = storage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "udmurt") return stored;
  if (!stored && matchDark) return "dark";
  return "light";
}

/** Применяет тему на <html> (class .dark + data-theme) и сохраняет выбор. */
export function applyTheme(
  theme: ThemeName,
  env: {
    documentElement: HTMLElement;
    storage?: Pick<Storage, "setItem"> | null;
  },
) {
  env.documentElement.classList.toggle("dark", theme === "dark");
  if (theme === "udmurt") {
    env.documentElement.setAttribute("data-theme", "udmurt");
  } else {
    env.documentElement.removeAttribute("data-theme");
  }
  if (env.storage) {
    try {
      env.storage.setItem(STORAGE_KEY, theme);
    } catch {
      /* localStorage недоступен — тема живёт до перезагрузки */
    }
  }
}

/** Циклический переход светлая → тёмная → удмуртская → светлая. */
export function cycleTheme(current: ThemeName): ThemeName {
  const idx = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
}
