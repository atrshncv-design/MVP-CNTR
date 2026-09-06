/**
 * Человекочитаемые даты для публичных разделов.
 * Форматтер создаётся один раз на уровне модуля (чистая функция —
 * без side-эффектов в теле рендера, см. react-hooks/purity).
 * RU-варианты ниже (formatRuDate/formatRuDateTime) — легаси-шимы под
 * pinned-тест новостей; новые экраны используют formatDateLocale/
 * formatDateTimeLocale/formatRelativeT с текущей локалью и словарём (T06, R01).
 */

import type { TranslateFn } from "./types";

const ruDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  // Backend отдаёт ISO в UTC (datetime.now(UTC).isoformat()).
  timeZone: "UTC",
});

const ruDateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** «14 августа 2026»; для null/невалидной строки — пустая строка. */
export function formatRuDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return ruDateFormatter.format(date);
}

/** «14 августа 2026, 14:05»; для null/невалидной строки — пустая строка. */
export function formatRuDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return ruDateTimeFormatter.format(date);
}

/** «31.03.2027» — короткий формат для карточек (G47, 02). */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Локаль Intl под next-intl (то же решение, что dateTimeLocale в
 * features/project/i18n.ts): ru → ru-RU, иначе en-GB.
 */
function intlLocale(locale: string): string {
  return locale === "ru" ? "ru-RU" : "en-GB";
}

/**
 * Локализованная дата под текущую локаль (T06, R01):
 * RU «14 августа 2026», EN «14 August 2026». Пусто для null/невалидной.
 */
export function formatDateLocale(locale: string, iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Локализованные дата+время под текущую локаль (T06, R01). */
export function formatDateTimeLocale(locale: string, iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Относительная дата через словарь common целыми строками с параметрами
 * (T06, R01.3): порядок слов и единицы задаёт словарь, склейки в коде нет.
 */
export function formatRelativeT(t: TranslateFn, iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return t("relativeToday");
  if (diffDays === 1) return t("relativeDayOne");
  if (diffDays < 5) return t("relativeDaysFew", { days: diffDays });
  if (diffDays < 21) return t("relativeDaysMany", { days: diffDays });
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 1) return t("relativeDaysMany", { days: diffDays });
  if (diffMonths === 1) return t("relativeMonthOne");
  return t("relativeMonths", { months: diffMonths });
}
