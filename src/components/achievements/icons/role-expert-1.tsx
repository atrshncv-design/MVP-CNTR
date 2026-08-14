// role-expert-1 — Первая экспертиза (role, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function RoleExpert1Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-warning)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="10.7" cy="10.7" r="5.1" /><path d="M14.5 14.5l4.1 4.1" /><path d="M8.8 9.4h3.8" /><path d="M8.8 11.2h2.5" />
    </svg>
  );
}
