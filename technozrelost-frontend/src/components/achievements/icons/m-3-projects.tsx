// m-3-projects — Мультипроектность (3+ проектов одновременно) (member, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function M3ProjectsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--medal-member)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="8" cy="9.4" r="4.6" /><circle cx="16" cy="9.4" r="4.6" /><circle cx="12" cy="15.4" r="4.6" />
    </svg>
  );
}
