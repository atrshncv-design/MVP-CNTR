/**
 * TolezeLogo — логотип платформы «Технозрелость».
 *
 * Геометрия: ДОСЛОВНО оригинальный path удмуртского символа «толэзе»
 * (Wikimedia Commons «Udmurt_symbol.svg», public domain):
 *   m1 0 2 2H0l2-2v3L0 1h3L1 3z   (viewBox 0 0 3 3)
 * Пересчитан в viewBox 0 0 96 96 (scale 25.6, offset 9.6) — форма не изменена.
 *
 * Стилизация (техно / circuit):
 *   — тёмная плашка (графит) с тонкой красной обводкой;
 *   — внешний контур звезды — неоновый акцент с мягким свечением;
 *   — внутренний контур — кремовый, тонкий (дорожка платы);
 *   — 8 светящихся узлов на вершинах + центральный узел.
 */

const OUTER =
  "M35.2 9.6 L86.4 60.8 H9.6 L60.8 9.6 V86.4 L9.6 35.2 H86.4 L35.2 86.4 Z";
const INNER =
  "M38.78 20.35 L75.65 57.22 H20.35 L57.22 20.35 V75.65 L20.35 38.78 H75.65 L38.78 75.65 Z";
const NODES: Array<[number, number]> = [
  [35.2, 9.6],
  [86.4, 60.8],
  [9.6, 60.8],
  [60.8, 9.6],
  [60.8, 86.4],
  [9.6, 35.2],
  [86.4, 35.2],
  [35.2, 86.4],
];

export default function TolezeLogo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Неоновое свечение внешнего контура */}
        <filter id="tz-neon" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Внешний контур звезды — неоновый акцент */}
      <path
        d={OUTER}
        fill="none"
        stroke="var(--tz-accent)"
        strokeWidth="2.6"
        strokeLinejoin="miter"
        strokeLinecap="square"
        filter="url(#tz-neon)"
      />

      {/* Внутренний контур — кремовая «дорожка платы» */}
      <path
        d={INNER}
        fill="none"
        stroke="var(--tz-bg)"
        strokeOpacity="0.65"
        strokeWidth="1.1"
        strokeLinejoin="miter"
      />

      {/* Узлы на 8 вершинах */}
      {NODES.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.1" fill="var(--tz-bg)" />
      ))}

      {/* Центральный узел */}
      <circle cx="48" cy="48" r="3.4" fill="var(--tz-bg)" />
      <circle cx="48" cy="48" r="1.5" fill="var(--tz-accent)" />
    </svg>
  );
}
