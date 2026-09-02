import { defineRouting } from "next-intl/routing";

import { locales, defaultLocale } from "./config";

/**
 * Роутинг next-intl — без префикса в URL, locale только в cookie.
 * Почему defineRouting: требуется next-intl 4.x для типизации, даже без /[locale] сегмента.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "never",
});
