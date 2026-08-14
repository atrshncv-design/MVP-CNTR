// sector-energy — Энергетика (sector, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SectorEnergyIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="7.4" /><path d="M13.1 6.4L8 13.3h3.7L10.9 18.6l5.3-7.5h-3.7Z" /><path d="M17.20 5.60L17.50 6.30L18.20 6.60L17.50 6.90L17.20 7.60L16.90 6.90L16.20 6.60L16.90 6.30Z" fill="var(--tz-accent)" stroke="none" />
    </svg>
  );
}
