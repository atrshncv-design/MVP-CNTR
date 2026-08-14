// proj-first-request — Первая заявка на переход УГТ (project, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function ProjFirstRequestIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4.2 17.2L19.8 5.2l-5.8 13.8-2.3-6.6Z" /><path d="M19.8 5.2l-8.1 7.2" />
    </svg>
  );
}
