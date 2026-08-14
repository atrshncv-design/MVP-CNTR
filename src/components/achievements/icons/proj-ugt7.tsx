// proj-ugt7 — Пилот — УГТ 7 (project, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function ProjUgt7Icon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4.8 19.6v-7.2h14.4v7.2" /><path d="M6.4 12.4V9.6h2.5v2.8" /><path d="M10.2 12.4V6.8h2.5v5.6" /><path d="M14.2 12.4V5h2.5v7.4" /><path d="M10.9 19.6v-2.7h2.2v2.7" /><path d="M15.5 4.6c-.7-.8.2-1.5-.3-2.3" /><path d="M16.3 5c.8-.9-.2-1.6.3-2.4" />
    </svg>
  );
}
