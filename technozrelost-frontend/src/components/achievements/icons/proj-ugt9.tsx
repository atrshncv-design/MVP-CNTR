// proj-ugt9 — Полный путь 1→9 (project, legendary)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function ProjUgt9Icon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4.8 16.2L6.3 8.6l3.9 3.9L12 7l1.8 5.5 3.9-3.9 1.5 7.6Z" /><path d="M5.8 18.2h12.4" />
    </svg>
  );
}
