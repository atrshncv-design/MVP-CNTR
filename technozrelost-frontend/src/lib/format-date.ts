/**
 * Человекочитаемые даты для публичных разделов.
 * Форматтер создаётся один раз на уровне модуля (чистая функция —
 * без side-эффектов в теле рендера, см. react-hooks/purity).
 */

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
