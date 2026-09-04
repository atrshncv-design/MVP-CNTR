/**
 * Translators for content dictionaries (task 01 seam).
 * Production screens use useTranslations / getTranslations from next-intl;
 * this factory builds the same standard translator for a namespace + locale
 * explicitly (tests, scripts). No locale is the default: callers pass one.
 */

import { createTranslator } from "next-intl";
import type { TranslateFn } from "./types";
import ruMessages from "../messages/ru.json" with { type: "json" };
import enMessages from "../messages/en.json" with { type: "json" };

export type AppLocale = "ru" | "en";
export type ContentNamespace = "ugt" | "showcase" | "taxonomy";

/** Standard next-intl translator scoped to a content namespace and locale. */
export function translatorFor(namespace: ContentNamespace, locale: AppLocale): TranslateFn {
  const messages = locale === "ru" ? ruMessages : enMessages;
  const t = createTranslator({ locale, namespace, messages }) as unknown as TranslateFn;
  const fn: TranslateFn = (key, params) => t(key, params);
  fn.raw = (key) => t.raw(key);
  return fn;
}

/**
 * Raw content dictionaries (seam for file-level invariants, e.g. tests
 * asserting EN purity or key parity without reading files directly).
 */
export function contentMessages(locale: AppLocale): unknown {
  return locale === "ru" ? ruMessages : enMessages;
}
