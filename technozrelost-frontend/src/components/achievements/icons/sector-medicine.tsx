// sector-medicine — Медицина (sector, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SectorMedicineIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M10 4.6h4v5.4h5.4v4H14v5.4h-4V14H4.6v-4H10Z" /><circle cx="12" cy="12" r="0.8" fill="var(--tz-accent)" stroke="none" />
    </svg>
  );
}
