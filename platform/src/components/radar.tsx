/**
 * D-03. Радар четырёх измерений готовности — чистый SVG, без библиотек.
 *
 * Контракт (тикет 03-d03-radar.md, спека A1):
 *   scores: { dimension: string; score: number }[]  // 0..max
 *   max?: number    // default 10
 *   size?: number   // default 260
 *   labels?: boolean // подписи осей
 *   accent?: string  // hex или токен; default var(--accent)
 *
 * Реализация:
 * - полигон данных (заливка var(--accent-soft), контур var(--accent)) +
 *   контурная сетка 5 уровней + спицы осей + подписи;
 * - пустые scores: честное «Нет данных для радара» — контур (кольца) без
 *   заливки, нулевой полигон не рисуется;
 * - цвета только токены: сетка var(--text-muted), заливка
 *   var(--accent)/var(--accent-soft), подписи var(--text-primary);
 * - роль-изображение: role="img" + aria-label с перечислением значений;
 * - prefers-reduced-motion: без анимации (лёгкий fade — только при
 *   no-preference; глобальный reduced-motion слой globals.css тоже глушит);
 * - масштабируется по size: viewBox = size, сетка пропорциональна.
 *
 * Цвета задаются inline-style (style), а не presentation-атрибутами:
 * CSS-переменные (var(--token)) в presentation-атрибутах SVG не
 * резолвятся браузерами, в CSSOM-style — резолвятся гарантированно.
 */

import type { JSX } from "react";

export interface RadarChartProps {
  /** Оси и значения в диапазоне 0..max. Пустой массив — «нет данных». */
  scores: { dimension: string; score: number }[];
  /** Максимум шкалы. По умолчанию 10. */
  max?: number;
  /** Ширина/высота SVG в px; viewBox = size масштабирует сетку. */
  size?: number;
  /** Показывать подписи осей. */
  labels?: boolean;
  /** Цвет акцента: токен (var(--accent) по умолчанию) или hex. */
  accent?: string;
}

/** Уровней контурной сетки (тикет: «10 уровней или 5»). */
const GRID_LEVELS = 5;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Точка на окружности; angleDeg отсчитывается от «12 часов» по часовой. */
function pointOnCircle(
  center: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = toRadians(angleDeg - 90);
  return {
    x: center + radius * Math.cos(rad),
    y: center + radius * Math.sin(rad),
  };
}

function clampScore(score: number, max: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(score, max));
}

export function RadarChart({
  scores,
  max = 10,
  size = 260,
  labels = true,
  accent = "var(--accent)",
}: RadarChartProps): JSX.Element {
  const center = size / 2;
  // Отступ под подписи осей: верх/низ — горизонтальные, лево/право —
  // вертикальные (длинные русские названия помещаются в квадрат size).
  const radius = size / 2 - 24;
  const count = scores.length;
  const hasData = count > 0;

  // Кастомный accent (hex) не имеет soft-варианта — заливка тем же цветом
  // с пониженной непрозрачностью; токену соответствует var(--accent-soft).
  const usesTokenAccent = accent.startsWith("var(");
  const polygonFill = usesTokenAccent ? "var(--accent-soft)" : accent;
  const polygonFillOpacity = usesTokenAccent ? 1 : 0.18;

  const ariaLabel = hasData
    ? `Радар готовности: ${scores
        .map((item) => `${item.dimension} ${clampScore(item.score, max)}`)
        .join(", ")}`
    : "Нет данных для радара";

  /* Контурная сетка: GRID_LEVELS полигонов (k/levels от центра). */
  const gridPolygons = Array.from({ length: GRID_LEVELS }, (_, index) => {
    const level = index + 1;
    const levelRadius = (radius * level) / GRID_LEVELS;
    const points = Array.from({ length: count }, (_, axisIndex) => {
      const point = pointOnCircle(
        center,
        levelRadius,
        (360 / count) * axisIndex,
      );
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    }).join(" ");
    return { points, isOuter: level === GRID_LEVELS };
  });

  /* Спицы осей: центр → внешнее кольцо. */
  const spokes = Array.from({ length: count }, (_, axisIndex) => {
    const point = pointOnCircle(center, radius, (360 / count) * axisIndex);
    return { x2: point.x, y2: point.y };
  });

  /* Полигон данных. */
  const dataPoints = scores.map((item, axisIndex) =>
    pointOnCircle(
      center,
      (radius * clampScore(item.score, max)) / max,
      (360 / count) * axisIndex,
    ),
  );
  const polygonPoints = dataPoints
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible", display: "block" }}
    >
      <style>{`
        @keyframes radar-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .radar-data {
          animation: radar-fade 0.45s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .radar-data { animation: none; }
        }
      `}</style>

      {hasData ? (
        <g aria-hidden="true">
          {gridPolygons.map(({ points, isOuter }, index) => (
            <polygon
              key={`grid-${index}`}
              points={points}
              fill="none"
              strokeWidth={1}
              strokeOpacity={isOuter ? 0.6 : 0.35}
              style={{ stroke: "var(--text-muted)" }}
            />
          ))}
          {spokes.map((spoke, index) => (
            <line
              key={`spoke-${index}`}
              x1={center}
              y1={center}
              x2={spoke.x2}
              y2={spoke.y2}
              strokeWidth={1}
              strokeOpacity={0.45}
              style={{ stroke: "var(--text-muted)" }}
            />
          ))}

          <g className="radar-data">
            <polygon
              points={polygonPoints}
              fillOpacity={polygonFillOpacity}
              strokeWidth={2}
              strokeLinejoin="round"
              style={{ fill: polygonFill, stroke: accent }}
            />
            {dataPoints.map((point, index) => (
              <circle
                key={`dot-${index}`}
                cx={point.x}
                cy={point.y}
                r={3.5}
                strokeWidth={1.5}
                style={{ fill: accent, stroke: "var(--surface)" }}
              />
            ))}
          </g>
        </g>
      ) : (
        <g aria-hidden="true">
          {/* Пустой контур без заливки: концентрические кольца. */}
          {Array.from({ length: GRID_LEVELS }, (_, index) => {
            const level = index + 1;
            return (
              <circle
                key={`ring-${index}`}
                cx={center}
                cy={center}
                r={radius * (level / GRID_LEVELS)}
                fill="none"
                strokeWidth={1}
                strokeOpacity={level === GRID_LEVELS ? 0.6 : 0.35}
                style={{ stroke: "var(--text-muted)" }}
              />
            );
          })}
        </g>
      )}

      {hasData && labels
        ? scores.map((item, axisIndex) => {
            const angleDeg = (360 / count) * axisIndex;
            const rad = toRadians(angleDeg - 90);
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const point = pointOnCircle(center, radius + 10, angleDeg);

            // Боковые оси (лево/право): вертикальная подпись — длинные
            // русские названия осей помещаются в квадрат size без обрезки.
            if (Math.abs(cos) > 0.3) {
              const rotate = cos < 0 ? -90 : 90;
              return (
                <text
                  key={`label-${axisIndex}`}
                  x={point.x}
                  y={point.y}
                  textAnchor="middle"
                  transform={`rotate(${rotate} ${point.x} ${point.y})`}
                  fontSize={11}
                  aria-hidden="true"
                  style={{
                    fill: "var(--text-primary)",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {item.dimension}
                </text>
              );
            }

            // Верх/низ: горизонтальная подпись по центру оси.
            const dy = sin < -0.5 ? -8 : 16;
            return (
              <text
                key={`label-${axisIndex}`}
                x={point.x}
                y={point.y}
                dy={dy}
                textAnchor="middle"
                fontSize={11}
                aria-hidden="true"
                style={{
                  fill: "var(--text-primary)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {item.dimension}
              </text>
            );
          })
        : null}

      {!hasData ? (
        <text
          x={center}
          y={center + 3}
          textAnchor="middle"
          fontSize={13}
          aria-hidden="true"
          style={{
            fill: "var(--text-secondary)",
            fontFamily: "var(--font-sans)",
          }}
        >
          Нет данных для радара
        </text>
      ) : null}
    </svg>
  );
}
