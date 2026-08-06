/**
 * D-05. BarChart — бар-чарт распределения (чистый SVG, без библиотек).
 *
 * Контракт (тикет D-05): data {label, value}[], height=160, color=var(--accent),
 * ariaLabel. Токены: var(--border-subtle) — сетка, var(--text-muted) — подписи,
 * accent — заливка. role="img" + aria-label. Пустые данные → честное
 * «Нет данных для графика». reduced-motion — без анимации.
 *
 * Мобильная вёрстка: SVG масштабируется по ширине контейнера (viewBox +
 * width="100%"), подписи переносятся/сжимаются — вёрстка не ломается.
 */

import type { JSX } from "react";

export interface BarChartProps {
  data: { label: string; value: number }[];
  /** Высота области графика (без подписей). */
  height?: number; // default 160
  /** Цвет заливки баров. */
  color?: string; // default var(--accent)
  /** Доступное описание графика. */
  ariaLabel: string;
}

/** Ширина одного бара в координатах viewBox. */
const BAR_WIDTH = 28;
/** Отступ между барами (центры на расстоянии BAR_STEP). */
const BAR_STEP = 44;
/** Высота полосы подписей оси X. */
const LABEL_STRIP = 22;
/** Отступ сверху под значения. */
const TOP_PAD = 14;

const ANIMATION_CSS = `
@keyframes tz-bar-grow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
@media (prefers-reduced-motion: no-preference) {
  .tz-bar-grow {
    transform-box: fill-box;
    transform-origin: bottom;
    animation: tz-bar-grow 480ms ease-out both;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tz-bar-grow { animation: none; }
}
`;

export function BarChart({
  data,
  height = 160,
  color = "var(--accent)",
  ariaLabel,
}: BarChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex min-h-[96px] items-center justify-center rounded-panel border border-dashed border-subtle bg-surface px-4 py-6 text-center text-small text-secondary"
      >
        Нет данных для графика
      </div>
    );
  }

  const maxValue = Math.max(1, ...data.map((d) => Math.max(0, d.value)));
  const chartWidth = Math.max(data.length * BAR_STEP + BAR_WIDTH, BAR_STEP * 2);
  const plotHeight = Math.max(height - LABEL_STRIP - TOP_PAD, 24);
  const baselineY = TOP_PAD + plotHeight;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-x-auto">
      <style>{ANIMATION_CSS}</style>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${chartWidth} ${height}`}
        width="100%"
        height={height}
        className="block h-auto min-w-[280px]"
        style={{ maxWidth: chartWidth }}
      >
        {/* Сетка: горизонтальные линии на долях максимума. */}
        {gridLines.map((fraction) => {
          const y = baselineY - fraction * plotHeight;
          return (
            <line
              key={fraction}
              x1={0}
              x2={chartWidth}
              y1={y}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth={1}
              strokeDasharray={fraction === 0 ? undefined : "3 4"}
            />
          );
        })}

        {/* Бары. */}
        {data.map((item, index) => {
          const value = Math.max(0, item.value);
          const barHeight = value === 0 ? 2 : (value / maxValue) * plotHeight;
          const x = index * BAR_STEP + (BAR_STEP - BAR_WIDTH) / 2;
          const y = baselineY - barHeight;
          const centerX = index * BAR_STEP + BAR_STEP / 2;
          return (
            <g key={item.label}>
              <title>{`${item.label}: ${item.value}`}</title>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barHeight}
                rx={4}
                fill={color}
                className="tz-bar-grow"
              />
              <text
                x={centerX}
                y={y - 6}
                textAnchor="middle"
                className="fill-[var(--text-muted)]"
                style={{ fontSize: 10 }}
              >
                {item.value}
              </text>
              <text
                x={centerX}
                y={height - 7}
                textAnchor="middle"
                className="fill-[var(--text-muted)]"
                style={{ fontSize: 10 }}
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
