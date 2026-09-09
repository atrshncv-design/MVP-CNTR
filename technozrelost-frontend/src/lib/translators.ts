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
import zhMessages from "../messages/zh.json" with { type: "json" };
import hiMessages from "../messages/hi.json" with { type: "json" };

export type AppLocale = "ru" | "en" | "zh" | "hi";
export type ContentNamespace = "ugt" | "showcase" | "taxonomy";

const catalogMessages = { ru: ruMessages, en: enMessages, zh: zhMessages, hi: hiMessages } as const;

/** Standard next-intl translator scoped to a content namespace and locale. */
export function translatorFor(namespace: ContentNamespace, locale: AppLocale): TranslateFn {
  const messages = catalogMessages[locale] ?? enMessages;
  const t = createTranslator({ locale, namespace, messages }) as unknown as TranslateFn;
  // T17: fallback zh -> en; T18: то же для hi — недостающий ключ отдаёт
  // английскую строку (или эхо ключа, если нет и в EN), а не пустое место.
  const enT =
    locale === "zh" || locale === "hi"
      ? (createTranslator({ locale: "en", namespace, messages: enMessages }) as unknown as TranslateFn)
      : null;
  const fn: TranslateFn = (key, params) => {
    const val = t(key, params);
    if (typeof val === "string" && val === key && enT) {
      const fb = enT(key, params);
      if (typeof fb === "string" && fb.length > 0) return fb;
    }
    return val;
  };
  fn.raw = (key) => {
    // ru/en — поведение прежнее (бросает как раньше); zh падает в EN.
    if (!enT) return t.raw(key);
    try {
      return t.raw(key);
    } catch {
      return enT.raw(key);
    }
  };
  return fn;
}

/**
 * Raw content dictionaries (seam for file-level invariants, e.g. tests
 * asserting EN purity or key parity without reading files directly).
 */
export function contentMessages(locale: AppLocale): unknown {
  if (locale === "zh") return zhMessages;
  if (locale === "hi") return hiMessages;
  return locale === "ru" ? ruMessages : enMessages;
}

/**
 * Current locale for compat shims: NEXT_LOCALE cookie when readable
 * (browser, tests), else the app default from i18n/config (fail-closed).
 * No display strings here — resolution always goes through translatorFor.
 */
export function shimLocale(): AppLocale {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(ru|en|zh|hi)`));
    if (match) return match[1] as AppLocale;
  }
  return parseLocale(undefined);
}
