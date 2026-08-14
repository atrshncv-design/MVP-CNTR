// proj-ugt6 — Демонстратор — УГТ 6 (project, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function ProjUgt6Icon(props: SVGProps<SVGSVGElement>) {
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
      <rect x="4.8" y="5.6" width="14.4" height="9.2" rx="0.6" /><path d="M9.6 17.8h4.8" /><path d="M7.8 19.8h8.4" /><path d="M9.8 9.2l3.8 2.2-3.8 2.2Z" />
    </svg>
  );
}
