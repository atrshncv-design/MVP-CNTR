// sector-transport — Транспорт (sector, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SectorTransportIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M6.2 15.4V9.4h8.2v6" /><path d="M14.4 11.4h3.3l2.1 2.3v1.7h-5.4" /><circle cx="8.9" cy="17.1" r="1.5" /><circle cx="16.5" cy="17.1" r="1.5" /><circle cx="18.9" cy="13.6" r="0.55" fill="var(--tz-accent)" stroke="none" />
    </svg>
  );
}
