/**
 * T-005. Канонический бейдж УГТ (Design.md §10, STATES.md §2).
 * Тон бейджа — цвет уровня (UGT_LEVEL_COLORS, D-07), текст — контрастный
 * (UGT_LEVEL_TEXT_COLORS: белый на тёмных тонах, тёмный на светлых).
 * Цвет — не единственный канал: маркер (форма: ромб в светлой/тёмной,
 * восьмиконечная звезда в удмуртской теме), число и подпись band передают
 * смысл без цвета.
 */

import {
  UGT_BAND_META,
  UGT_LEVEL_COLORS,
  UGT_LEVEL_TEXT_COLORS,
  bandOfLevel,
  bandRangeLabel,
  ugtLevelInfo,
} from "@/lib/ugt";

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

  const tone = UGT_LEVEL_COLORS[level - 1];
  const text = UGT_LEVEL_TEXT_COLORS[level - 1];

  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-control py-1 pl-1 pr-3 ${className}`}
      style={{ backgroundColor: tone }}
    >
      <span className="ugt-marker" style={{ color: text }} aria-hidden />
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-small font-semibold" style={{ color: text }}>
          УГТ {level}
        </span>
        <span className="text-small font-medium leading-tight" style={{ color: text }}>
          {info.name}
        </span>
        {showBand ? (
          <span className="text-meta leading-tight" style={{ color: text }}>
            {UGT_BAND_META[band].shortLabel} · {bandRangeLabel(band)}
          </span>
        ) : null}
      </span>
    </span>
  );
}
