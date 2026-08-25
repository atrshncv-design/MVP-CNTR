// s-legend — Легенда платформы (100+ медалей) (secret, legendary)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SLegendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-secondary)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5.2 15.4l1.3-5.7 3 2.8 2.5-4.1 2.5 4.1 3-2.8 1.3 5.7Z" /><path d="M5.9 17.7h12.2" /><path d="M12.00 4.40L12.36 5.24L13.20 5.60L12.36 5.96L12.00 6.80L11.64 5.96L10.80 5.60L11.64 5.24Z" fill="var(--tz-secondary)" stroke="none" />
    </svg>
  );
}
