/**
 * Конфигурация локали — P3 R01, зона src/i18n/.
 * Почему отдельный модуль: единый источник правды для default/locale/cookie,
 * используется в layout (SSR), в toggle (CSR) и в request.ts (next-intl server).
 */

export const locales = ["ru", "en", "zh", "hi"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

/** Имя cookie для хранения выбранного языка — default RU, хранится в cookie */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Допустимые значения cookie — fail-closed к ru (T17: +zh, T18: +hi, default прежний) */
export function parseLocale(value: string | undefined | null): Locale {
  if (value === "en") return "en";
  if (value === "zh") return "zh";
  if (value === "hi") return "hi";
  return "ru";
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
