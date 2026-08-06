/**
 * T-005. Уведомление об устаревших данных (STATES.md §3 «Stale data»):
 * показывает timestamp последнего обновления и не создаёт впечатления
 * реального времени. Применяется там, где данные могли устареть.
 */

import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";

export interface StaleNoticeProps {
  /** Когда данные обновлены в последний раз (Date или ISO-строка). */
  updatedAt: Date | string;
  /** Дополнительное пояснение (по умолчанию — про возможную неактуальность). */
  detail?: ReactNode;
}

export function StaleNotice({
  updatedAt,
  detail = "Сведения могут быть неактуальными — проверьте перед принятием решения.",
}: StaleNoticeProps) {
  const formatted = formatDateTime(updatedAt);
  return (
    <div className="flex flex-wrap items-start gap-2.5 rounded-control border border-subtle bg-canvas/70 px-3.5 py-2.5">
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
      <p className="text-small leading-relaxed text-secondary">
        <span className="font-medium text-primary">Данные обновлены </span>
        <time dateTime={typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString()}>
          {formatted || "—"}
        </time>
        . {detail}
      </p>
    </div>
  );
}
