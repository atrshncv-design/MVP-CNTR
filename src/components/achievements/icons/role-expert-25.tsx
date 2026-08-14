// role-expert-25 — Признанный эксперт — 25 проверок (role, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function RoleExpert25Icon(props: SVGProps<SVGSVGElement>) {
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
      <rect x="8.6" y="9.6" width="6.8" height="3.6" rx="1.1" /><path d="M11 13.2L8 18.8" />
    </svg>
  );
}
