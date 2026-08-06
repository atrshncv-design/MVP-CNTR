/**
 * T-005. Канонический бейдж УГТ (Design.md §10, STATES.md §2).
 * Число + название уровня + band — цвет не единственный канал: маркер
 * (форма: ромб в светлой/тёмной, восьмиконечная звезда в удмуртской теме),
 * число и подпись band передают смысл без цвета.
 */

import {
  UGT_BAND_META,
  bandOfLevel,
  bandRangeLabel,
  ugtLevelInfo,
  type UgtBand,
} from "@/lib/ugt";

const BAND_TEXT: Record<UgtBand, string> = {
  low: "text-ugt-low",
  medium: "text-ugt-medium",
  high: "text-ugt-high",
};

const BAND_SOFT: Record<UgtBand, string> = {
  low: "bg-ugt-low-soft",
  medium: "bg-ugt-medium-soft",
  high: "bg-ugt-high-soft",
};

export interface UgtBadgeProps {
  /** Номер уровня 1–9. Вне диапазона бейдж не рендерится (null у вызывающего). */
  level: number;
  /** Показывать подпись band и диапазон («Средняя · 4–6»). */
  showBand?: boolean;
  /** Дополнительные классы. */
  className?: string;
}

export function UgtBadge({ level, showBand = true, className = "" }: UgtBadgeProps) {
  const info = ugtLevelInfo(level);
  const band = bandOfLevel(level);
  if (!info || !band) return null;

  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-control py-1 pl-1 pr-3 ${BAND_SOFT[band]} ${className}`}
    >
      <span className={`ugt-marker ${BAND_TEXT[band]}`} aria-hidden />
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`font-mono text-small font-semibold ${BAND_TEXT[band]}`}>
          УГТ {level}
        </span>
        <span className="text-small font-medium leading-tight text-primary">
          {info.name}
        </span>
        {showBand ? (
          <span className="text-meta leading-tight text-secondary">
            {UGT_BAND_META[band].shortLabel} · {bandRangeLabel(band)}
          </span>
        ) : null}
      </span>
    </span>
  );
}
