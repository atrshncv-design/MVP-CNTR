/**
 * D-05. Sparkline — мини-график тренда (чистый SVG, без библиотек).
 *
 * Контракт (тикет D-05): points: number[], height=40, color=var(--accent),
 * ariaLabel. Токены: var(--text-muted) — при необходимости, accent — линия.
 * role="img" + aria-label. Меньше двух точек / пусто → честное
 * «Нет данных для графика». reduced-motion — без анимации прорисовки.
 *
 * Ширина считается от количества точек (точка → шаг 14px в viewBox),
 * SVG масштабируется по ширине контейнера.
 */

import type { JSX } from "react";

export interface SparklineProps {
  /** Ряд значений (≥0), по порядку слева направо. */
  points: number[];
  /** Высота области графика. */
  height?: number; // default 40
  /** Цвет линии и точек. */
  color?: string; // default var(--accent)
  /** Доступное описание графика. */
  ariaLabel: string;
}

/** Горизонтальный шаг на одну точку (в координатах viewBox). */
const POINT_STEP = 14;
/** Горизонтальный отступ слева/справа. */
const H_PAD = 4;
/** Вертикальный отступ сверху/снизу. */
const V_PAD = 3;

const ANIMATION_CSS = `
@keyframes tz-spark-draw {
  from { stroke-dashoffset: 1000; }
  to { stroke-dashoffset: 0; }
}
@media (prefers-reduced-motion: no-preference) {
  .tz-spark-line {
    stroke-dasharray: 1000;
    animation: tz-spark-draw 900ms ease-out both;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tz-spark-line { animation: none; }
}
`;

export function Sparkline({
  points,
  height = 40,
  color = "var(--accent)",
  ariaLabel,
}: SparklineProps): JSX.Element {
  if (points.length < 2) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex min-h-[40px] items-center justify-center rounded-panel border border-dashed border-subtle bg-surface px-4 py-2 text-center text-meta text-secondary"
      >
        Нет данных для графика
      </div>
    );
  }

  const values = points.map((p) => Math.max(0, p));
  const maxValue = Math.max(1, ...values);
  const minValue = Math.min(...values);
  // Если все значения равны — линия по середине высоты.
  const range = maxValue - minValue || 1;

  const width = (values.length - 1) * POINT_STEP + H_PAD * 2;
  const plotHeight = height - V_PAD * 2;

  const coords = values.map((value, index) => {
    const x = H_PAD + index * POINT_STEP;
    const y = V_PAD + plotHeight - ((value - minValue) / range) * plotHeight;
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0]},${V_PAD + plotHeight} L${coords[0][0]},${V_PAD + plotHeight} Z`;
  const last = coords[coords.length - 1];

  return (
    <div className="overflow-x-auto">
      <style>{ANIMATION_CSS}</style>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        className="block h-auto min-w-[80px]"
        style={{ maxWidth: width }}
      >
        <path d={areaPath} fill={color} fillOpacity={0.1} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="tz-spark-line"
        />
        <circle
          cx={last[0]}
          cy={last[1]}
          r={2.5}
          fill={color}
        />
      </svg>
    </div>
  );
}
