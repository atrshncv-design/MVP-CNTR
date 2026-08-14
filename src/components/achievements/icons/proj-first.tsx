// proj-first — Первый проект команды (project, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function ProjFirstIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M6.8 4.5V20" /><path d="M6.8 5.3H16l-1.6 2.7 1.6 2.7H6.8Z" /><path d="M5.4 20H8.2" />
    </svg>
  );
}
