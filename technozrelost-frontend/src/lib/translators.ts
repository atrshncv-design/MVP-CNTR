/**
 * Translators for content dictionaries (task 01 seam).
 * Production screens use useTranslations / getTranslations from next-intl;
 * this factory builds the same standard translator for a namespace + locale
 * explicitly (tests, scripts). No locale is the default: callers pass one.
 */

import { createTranslator } from "next-intl";
import type { TranslateFn } from "./types";
import { LOCALE_COOKIE, parseLocale } from "../i18n/config.ts";
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

/**
 * Current locale for compat shims: NEXT_LOCALE cookie when readable
 * (browser, tests), else the app default from i18n/config (fail-closed).
 * No display strings here — resolution always goes through translatorFor.
 */
export function shimLocale(): AppLocale {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(ru|en)`));
    if (match) return match[1] as AppLocale;
  }
  return parseLocale(undefined);
}

/**
 * Thin compat list: every access resolves a fresh array through the
 * current-locale translator (tasks 02–05 remove these as screens migrate).
 * Behaves like a readonly array (map/filter/find/length/index/iteration).
 */
export function shimList<T>(namespace: ContentNamespace, resolve: (t: TranslateFn) => T[]): T[] {
  const materialize = (): T[] => resolve(translatorFor(namespace, shimLocale()));
  const target: T[] = [];
  return new Proxy(target, {
    get(_t, prop) {
      const arr = materialize();
      const value = Reflect.get(arr, prop);
      return typeof value === "function" ? (value as (...a: never[]) => unknown).bind(arr) : value;
    },
    has(_t, prop) {
      return Reflect.has(materialize(), prop);
    },
    ownKeys() {
      return Reflect.ownKeys(materialize());
    },
    getOwnPropertyDescriptor(_t, prop) {
      return Reflect.getOwnPropertyDescriptor(materialize(), prop);
    },
  }) as T[];
}
