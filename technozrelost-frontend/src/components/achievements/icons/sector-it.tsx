// sector-it — IT и цифровые платформы (sector, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SectorItIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-fg)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 7.5L4.9 12l4.1 4.5" /><path d="M15 7.5l4.1 4.5-4.1 4.5" /><path d="M14.2 6.2L9.8 17.8" stroke="var(--tz-accent)" strokeWidth={2} />
    </svg>
  );
}
