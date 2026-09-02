/**
 * Форматирование бюджета и чисел (тикет 08, G38, G47).
 * Почему отдельный модуль: бюджет всем виден единым форматом Intl.NumberFormat ru-RU RUB,
 * без «по запросу», даже investor. Используется в реестрах и карточке.
 */

/** Бюджет всем виден — форматирование RUB без дробей */
export function formatBudget(budget: number | null | undefined): string {
  if (budget == null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(budget);
}

/** Алиас для теста 08 */
export const formatBudgetRUB = formatBudget;

export { formatShortDate, formatRelative } from "./format-date";
