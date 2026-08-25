// sector-oil — Нефтедобыча (sector, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SectorOilIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 4.4c2.1 3.2 4.7 6 4.7 9a4.7 4.7 0 0 1-9.4 0c0-3 2.6-5.8 4.7-9Z" /><circle cx="12" cy="14.7" r="1.05" fill="var(--tz-accent)" stroke="none" />
    </svg>
  );
}
