/**
 * Зонный переводчик неймспейса registry для мест без хука useTranslations
 * (чистые утилиты exportXlsx/storage, дефолты useRegistry/useSavedFilters).
 * Построен через фабрику таска 01 (translatorFor/shimLocale из
 * src/lib/translators.ts) — своего wiring (createTranslator, импорт
 * словарей) здесь нет. Локаль — текущая (cookie NEXT_LOCALE, иначе
 * default приложения).
 */
import { shimLocale, translatorFor, type ContentNamespace } from "../../lib/translators.ts";
import type { TranslateFn } from "../../lib/types.ts";
import type { RegistryParams } from "../../lib/types.ts";

// registry — зонный неймспейс таска 03; фабрика типизирована под контентные
// неймспейсы таска 01, рантайм-резолв для скоупа registry — тот же стандартный.
const REGISTRY_NS = "registry" as ContentNamespace;

/** Стандартный next-intl переводчик скоупа registry под текущую локаль. */
export function registryTranslator(): TranslateFn {
  return translatorFor(REGISTRY_NS, shimLocale());
}

/**
 * Человекочитаемое описание сохранённого фильтра для списка «Мои фильтры».
 * Каждый фрагмент — целая строка словаря с параметрами, никакой склейки
 * русских слов в коде (R01.3): порядок слов в EN задаёт словарь.
 * Разделитель « · » слов не содержит.
 */
export function describeFiltersT(t: TranslateFn, filters: RegistryParams): string {
  const parts: string[] = [];
  if (filters.search) parts.push(t("savedDescSearch", { value: filters.search }));
  if (filters.tags?.length) parts.push(t("savedDescTags", { value: filters.tags.join(",") }));
  if (filters.ugt_min != null || filters.ugt_max != null) {
    parts.push(
      t("savedDescUgt", {
        min: String(filters.ugt_min ?? "—"),
        max: String(filters.ugt_max ?? "—"),
      }),
    );
  }
  if (filters.status) parts.push(t("savedDescStatus", { value: filters.status }));
  if (filters.region) parts.push(t("savedDescRegion", { value: filters.region }));
  if (filters.budget_min != null || filters.budget_max != null) {
    parts.push(
      t("savedDescBudget", {
        min: String(filters.budget_min ?? "—"),
        max: String(filters.budget_max ?? "—"),
      }),
    );
  }
  if (!parts.length) return t("savedDescEmpty");
  return parts.join(" · ");
}
