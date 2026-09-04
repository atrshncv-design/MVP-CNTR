/**
 * Зонный переводчик неймспейса project для мест без хука useTranslations
 * (чистые утилиты template.ts / utils.ts, дефолт useAutosave).
 * Построен через фабрику таска 01 (translatorFor/shimLocale из
 * src/lib/translators.ts) — своего wiring (createTranslator, импорт
 * словарей) здесь нет. Локаль — текущая (cookie NEXT_LOCALE, иначе
 * default приложения).
 */
import { shimLocale, translatorFor, type ContentNamespace } from "../../lib/translators.ts";
import type { TranslateFn } from "../../lib/types.ts";

// project — зонный неймспейс таска 02; фабрика типизирована под контентные
// неймспейсы таска 01, рантайм-резолв для скоупа project — тот же стандартный.
const PROJECT_NS = "project" as ContentNamespace;

/** Стандартный next-intl переводчик скоупа project под текущую локаль. */
export function projectTranslator(): TranslateFn {
  return translatorFor(PROJECT_NS, shimLocale());
}

/**
 * Формат даты/времени под локаль next-intl: ru → ru-RU, иначе en-GB.
 * Единое место маппинга (ActionsPanel, HistoryPanel); поведение прежнее.
 */
export function dateTimeLocale(locale: string): string {
  return locale === "ru" ? "ru-RU" : "en-GB";
}
