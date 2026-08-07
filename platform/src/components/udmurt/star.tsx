/**
 * D-06. Восьмиконечная звезда «толэзё» — модульная геометрия удмуртской темы
 * (Design.md §9.4, тикет D-06). Геометрия — два квадрата, повёрнутых на 45°
 * вокруг общего центра (классический способ построения звезды), НЕ иконка
 * из библиотеки. Цвет — токен var(--accent), размер — пропсом.
 * Компонент декоративный: aria-hidden.
 */

export interface UdmurtStarProps {
  /** Размер стороны в px. */
  size?: number;
  /** Дополнительные классы. */
  className?: string;
}

export function UdmurtStar({ size = 24, className = "" }: UdmurtStarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      {/* Квадрат 1 — по осям (вершины на серединах сторон viewBox) */}
      <rect x="6" y="6" width="12" height="12" fill="var(--accent)" />
      {/* Квадрат 2 — повёрнут на 45° вокруг центра (12, 12) */}
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        fill="var(--accent)"
        transform="rotate(45 12 12)"
      />
    </svg>
  );
}
