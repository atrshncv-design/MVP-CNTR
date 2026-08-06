/**
 * T-005. Форматирование дат/времени для интерфейса (ru-RU, детерминированно
 * между серверным и клиентским рендером). Только визуальные форматы:
 * данные не фабрикуются, отсутствующие даты остаются null и не выводятся.
 */

/** Полный формат: «06.08.2026, 14:32». */
export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Только дата: «06.08.2026». */
export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Относительная подпись для недавних дат; для старых — полная дата. */
export function formatRelativeOrDateTime(
  value: Date | string,
  now: Date = new Date(),
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return "только что";
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;
  if (diffMinutes < 24 * 60) {
    const hours = Math.floor(diffMinutes / 60);
    return `${hours} ч назад`;
  }
  return formatDateTime(date);
}
