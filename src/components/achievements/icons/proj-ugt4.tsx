// proj-ugt4 — Лабораторная победа — УГТ 4 (project, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function ProjUgt4Icon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M9.5 4.5h5" /><path d="M10.5 4.5v3.9l-3.9 8a2.1 2.1 0 0 0 1.9 3.1h7a2.1 2.1 0 0 0 1.9-3.1l-3.9-8V4.5" /><path d="M8.3 15h7.4" /><circle cx="12.7" cy="17.2" r="0.7" />
    </svg>
  );
}
