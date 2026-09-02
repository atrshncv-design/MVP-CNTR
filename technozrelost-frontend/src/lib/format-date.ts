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

/** «2 дня назад» — относительный тултип для короткой даты (G47). */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "сегодня";
  if (diffDays === 1) return "1 день назад";
  if (diffDays < 5) return `${diffDays} дня назад`;
  if (diffDays < 21) return `${diffDays} дней назад`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 1) return `${diffDays} дней назад`;
  if (diffMonths === 1) return "1 месяц назад";
  return `${diffMonths} мес. назад`;
}
