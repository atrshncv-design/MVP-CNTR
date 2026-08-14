// proj-ugt8 — Производство — УГТ 8 (project, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function ProjUgt8Icon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="3.1" /><path d="M16.6 12H17.6" /><path d="M15.25 8.75L15.96 8.04" /><path d="M12 7.4V6.4" /><path d="M8.75 8.75L8.04 8.04" /><path d="M7.4 12H6.4" /><path d="M8.75 15.25L8.04 15.96" /><path d="M12 16.6V17.6" /><path d="M15.25 15.25L15.96 15.96" /><circle cx="12" cy="12" r="1.1" />
    </svg>
  );
}
